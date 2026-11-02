from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# Auth Schemas
class UserRegister(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6)
    role: Optional[str] = "employee"  # "admin" or "employee"

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# Document Schemas
class DocumentAccessCreate(BaseModel):
    role: str

class DocumentResponse(BaseModel):
    id: UUID
    title: str
    status: str
    page_count: int
    allowed_roles: List[str] = []
    uploaded_at: datetime

    class Config:
        from_attributes = True

# Chat Schemas
class ChatRequest(BaseModel):
    session_id: Optional[UUID] = None
    question: str = Field(min_length=1)

class CitationItem(BaseModel):
    document_id: UUID
    title: str
    page_no: int
    snippet: str

class MessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    cited_chunk_ids: Optional[List[UUID]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime

    class Config:
        from_attributes = True

# Feedback Schemas
class FeedbackCreate(BaseModel):
    message_id: UUID
    rating: int = Field(ge=-1, le=1)  # -1 or +1
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: UUID
    message_id: UUID
    user_id: UUID
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

