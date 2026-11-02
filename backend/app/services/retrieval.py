from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.models import Chunk, Document, DocumentAccess
from app.services.ingestion import get_embedding_model

def search_dense(query: str, user_role: str, db: Session, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Top-K vector similarity search by cosine distance (<=> operator in pgvector).
    Strict access filter at SQL level:
    JOIN documents d ON d.id = c.document_id AND d.status = 'ready'
    JOIN document_access a ON a.document_id = d.id AND a.role = :user_role
    """
    embedder = get_embedding_model()
    query_vector = embedder.encode(query, normalize_embeddings=True).tolist()
    vector_str = f"[{','.join(str(x) for x in query_vector)}]"

    sql = text("""
        SELECT 
            c.id,
            c.document_id,
            c.chunk_index,
            c.page_no,
            c.section,
            c.text,
            d.title AS doc_title,
            (c.embedding <=> CAST(:vector AS vector)) AS distance
        FROM chunks c
        JOIN documents d ON d.id = c.document_id AND d.status = 'ready'
        JOIN document_access a ON a.document_id = d.id AND a.role = :user_role
        ORDER BY distance ASC
        LIMIT :limit
    """)

    results = db.execute(sql, {"vector": vector_str, "user_role": user_role, "limit": limit}).fetchall()
    
    chunks = []
    for row in results:
        chunks.append({
            "id": row.id,
            "document_id": row.document_id,
            "chunk_index": row.chunk_index,
            "page_no": row.page_no,
            "section": row.section,
            "text": row.text,
            "doc_title": row.doc_title,
            "score": float(row.distance)
        })
    return chunks

def search_sparse(query: str, user_role: str, db: Session, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Top-K sparse keyword search using Postgres full-text search (tsvector + plainto_tsquery).
    Ranked with ts_rank.
    Strict access filter at SQL level.
    """
    sql = text("""
        SELECT 
            c.id,
            c.document_id,
            c.chunk_index,
            c.page_no,
            c.section,
            c.text,
            d.title AS doc_title,
            ts_rank(c.tsv, plainto_tsquery('english', :query)) AS rank_score
        FROM chunks c
        JOIN documents d ON d.id = c.document_id AND d.status = 'ready'
        JOIN document_access a ON a.document_id = d.id AND a.role = :user_role
        WHERE c.tsv @@ plainto_tsquery('english', :query)
        ORDER BY rank_score DESC
        LIMIT :limit
    """)

    results = db.execute(sql, {"query": query, "user_role": user_role, "limit": limit}).fetchall()
    
    chunks = []
    for row in results:
        chunks.append({
            "id": row.id,
            "document_id": row.document_id,
            "chunk_index": row.chunk_index,
            "page_no": row.page_no,
            "section": row.section,
            "text": row.text,
            "doc_title": row.doc_title,
            "score": float(row.rank_score)
        })
    return chunks

def reciprocal_rank_fusion(dense_chunks: List[Dict[str, Any]], sparse_chunks: List[Dict[str, Any]], k: int = 60, top_k: int = 20) -> List[Dict[str, Any]]:
    """
    RRF Formula: score(chunk) = sum over lists of 1 / (k + rank_in_list)
    Returns merged top_k unique chunks with their combined RRF score.
    """
    rrf_scores = {}
    chunk_map = {}

    # Score dense list (rank starts at 1)
    for rank, chunk in enumerate(dense_chunks, start=1):
        c_id = chunk["id"]
        chunk_map[c_id] = chunk
        rrf_scores[c_id] = rrf_scores.get(c_id, 0.0) + (1.0 / (k + rank))

    # Score sparse list (rank starts at 1)
    for rank, chunk in enumerate(sparse_chunks, start=1):
        c_id = chunk["id"]
        chunk_map[c_id] = chunk
        rrf_scores[c_id] = rrf_scores.get(c_id, 0.0) + (1.0 / (k + rank))

    # Sort candidates by combined score descending
    sorted_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

    fused_candidates = []
    for cid in sorted_ids[:top_k]:
        candidate = dict(chunk_map[cid])
        candidate["rrf_score"] = rrf_scores[cid]
        fused_candidates.append(candidate)

    return fused_candidates

def retrieve_hybrid_candidates(query: str, user_role: str, db: Session, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Executes hybrid retrieval:
    1. Vector search (top 20)
    2. Keyword search (top 20)
    3. Merged with RRF -> top 20 candidates
    """
    dense_results = search_dense(query, user_role, db, limit=limit)
    sparse_results = search_sparse(query, user_role, db, limit=limit)
    return reciprocal_rank_fusion(dense_results, sparse_results, k=60, top_k=limit)

