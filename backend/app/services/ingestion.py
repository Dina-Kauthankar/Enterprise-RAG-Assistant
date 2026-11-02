import os
import re
import warnings
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm.session import Session
import numpy as np

# Suppress PyMuPDF deprecation warning
warnings.filterwarnings("ignore", category=FutureWarning, module="fitz")
import fitz  # PyMuPDF

from app.core.config import settings
from app.db.models import Document, Chunk
from app.db.session import SessionLocal

# Global model cache for CPU inference efficiency (Lazy Loaded)
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    return _embedding_model

def clean_text(text: str) -> str:
    # Replace weird unicode whitespace, repeated newlines, multiple spaces
    text = re.sub(r'[\r\f\v]', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n', '\n\n', text)
    return text.strip()

def chunk_page_text(text: str, max_chars: int = 2000, overlap_chars: int = 250) -> List[str]:
    """
    Split text into chunks of ~500 tokens (~2000 chars) with 10-15% overlap.
    Preserves paragraph breaks where possible.
    """
    if len(text) <= max_chars:
        return [text] if text.strip() else []

    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_len = 0

    for para in paragraphs:
        para_len = len(para)
        if current_len + para_len > max_chars and current_chunk:
            combined = "\n\n".join(current_chunk)
            chunks.append(combined)
            
            # Create overlap
            overlap_text = combined[-overlap_chars:] if len(combined) > overlap_chars else combined
            current_chunk = [overlap_text, para]
            current_len = len(overlap_text) + para_len
        else:
            current_chunk.append(para)
            current_len += para_len

    if current_chunk:
        combined = "\n\n".join(current_chunk).strip()
        if combined:
            chunks.append(combined)

    return chunks

def extract_and_chunk_pdf(file_path: str) -> List[Dict[str, Any]]:
    """
    Parses PDF using PyMuPDF per-page, cleans text, and splits into chunks.
    Ensures chunks do NOT cross page boundaries (for accurate citations).
    """
    doc = fitz.open(file_path)
    all_chunks = []
    chunk_index = 0

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_no = page_idx + 1
        raw_text = page.get_text()
        cleaned = clean_text(raw_text)
        if not cleaned:
            continue
            
        page_chunks = chunk_page_text(cleaned)
        for text in page_chunks:
            all_chunks.append({
                "chunk_index": chunk_index,
                "page_no": page_no,
                "text": text,
                "section": None
            })
            chunk_index += 1

    doc.close()
    return all_chunks

def process_document_pipeline(document_id: str):
    """
    Background worker:
    1. Updates status to 'processing'
    2. Extracts and chunks PDF
    3. Generates normalized BGE embeddings in batch
    4. Inserts chunks into Postgres
    5. Updates status to 'ready' (or 'failed' on error)
    """
    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        doc.status = "processing"
        db.commit()

        # Parse & Chunk
        parsed_chunks = extract_and_chunk_pdf(doc.file_path)
        if not parsed_chunks:
            doc.status = "failed"
            db.commit()
            return

        # Update page count
        max_page = max(c["page_no"] for c in parsed_chunks)
        doc.page_count = max_page

        # Generate Embeddings
        model = get_embedding_model()
        texts = [c["text"] for c in parsed_chunks]
        # BGE-small recommendation: normalize embeddings for cosine similarity
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)

        # Bulk create Chunk rows
        chunk_objects = []
        for i, c_data in enumerate(parsed_chunks):
            chunk_obj = Chunk(
                document_id=doc.id,
                chunk_index=c_data["chunk_index"],
                page_no=c_data["page_no"],
                section=c_data["section"],
                text=c_data["text"],
                embedding=embeddings[i].tolist()
            )
            chunk_objects.append(chunk_obj)

        db.bulk_save_objects(chunk_objects)
        doc.status = "ready"
        db.commit()

    except Exception as e:
        db.rollback()
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "failed"
                db.commit()
        except Exception:
            pass
        raise e
    finally:
        db.close()

