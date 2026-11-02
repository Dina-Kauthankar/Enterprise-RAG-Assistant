import os
import shutil
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Document, DocumentAccess, User
from app.schemas.schemas import DocumentResponse
from app.routers.auth import get_current_user, require_admin
from app.core.config import settings
from app.services.ingestion import process_document_pipeline

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    roles: List[str] = Form(...),  # e.g. ["admin", "employee"]
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported"
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file.filename}")
    
    # Save file to disk
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create Document record
    doc = Document(
        title=file.filename,
        file_path=file_path,
        status="pending",
        page_count=0,
        owner_id=current_user.id
    )
    db.add(doc)
    db.flush()

    # Create Access Roles
    for r in set(roles):
        r_clean = r.strip().lower()
        if r_clean in ["admin", "employee"]:
            access = DocumentAccess(document_id=doc.id, role=r_clean)
            db.add(access)

    db.commit()
    db.refresh(doc)

    # Queue background parsing, chunking, and embedding
    background_tasks.add_task(process_document_pipeline, str(doc.id))

    allowed = [a.role for a in doc.access_roles]
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        status=doc.status,
        page_count=doc.page_count,
        allowed_roles=allowed,
        uploaded_at=doc.uploaded_at
    )

@router.get("", response_model=List[DocumentResponse])
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Role-based document listing: documents that have an access rule for the user's role
    docs = (
        db.query(Document)
        .join(DocumentAccess, Document.id == DocumentAccess.document_id)
        .filter(DocumentAccess.role == current_user.role)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    results = []
    for d in docs:
        allowed = [a.role for a in d.access_roles]
        results.append(
            DocumentResponse(
                id=d.id,
                title=d.title,
                status=d.status,
                page_count=d.page_count,
                allowed_roles=allowed,
                uploaded_at=d.uploaded_at
            )
        )
    return results

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = (
        db.query(Document)
        .join(DocumentAccess, Document.id == DocumentAccess.document_id)
        .filter(Document.id == document_id, DocumentAccess.role == current_user.role)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found or access denied")

    allowed = [a.role for a in doc.access_roles]
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        status=doc.status,
        page_count=doc.page_count,
        allowed_roles=allowed,
        uploaded_at=doc.uploaded_at
    )

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: UUID, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Remove physical file if exists
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    # Chunks and access are removed via CASCADE
    db.delete(doc)
    db.commit()
    return None

