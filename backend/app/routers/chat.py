import json
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, ChatSession, Message
from app.schemas.schemas import ChatRequest, SessionResponse, MessageResponse
from app.routers.auth import get_current_user
from app.services.retrieval import retrieve_hybrid_candidates
from app.services.reranker import rerank_chunks
from app.services.llm import generate_rag_stream
from app.core.config import settings

router = APIRouter(tags=["Chat"])

@router.post("/chat")
async def chat_endpoint(
    chat_req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Manage ChatSession
    session_id = chat_req.session_id
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    else:
        # Create session with question prefix as title
        title = (chat_req.question[:40] + "...") if len(chat_req.question) > 40 else chat_req.question
        session = ChatSession(user_id=current_user.id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id

    # Save user message
    user_msg = Message(
        session_id=session_id,
        role="user",
        content=chat_req.question
    )
    db.add(user_msg)
    db.commit()

    # 2. Hybrid Retrieval with SQL-level RBAC
    candidates = retrieve_hybrid_candidates(chat_req.question, current_user.role, db, limit=20)

    # 3. Cross-Encoder Reranking
    top_chunks, best_score = rerank_chunks(chat_req.question, candidates, top_k=5)

    # 4. Confidence Check
    is_confident = (len(top_chunks) > 0 and best_score >= settings.RERANK_THRESHOLD)
    active_chunks = top_chunks if is_confident else []

    # Prepare citations payload
    citations = []
    for c in active_chunks:
        snippet_text = c["text"][:200].replace("\n", " ").strip()
        citations.append({
            "chunk_id": str(c["id"]),
            "document_id": str(c["document_id"]),
            "title": c["doc_title"],
            "page_no": c["page_no"],
            "snippet": f"{snippet_text}..."
        })

    cited_chunk_ids = [c["id"] for c in active_chunks]

    # Pre-create Assistant Message row so frontend gets message_id immediately for feedback
    assistant_msg = Message(
        session_id=session_id,
        role="assistant",
        content="",
        cited_chunk_ids=cited_chunk_ids
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    msg_id = str(assistant_msg.id)

    async def sse_event_generator():
        # First send session and message metadata
        init_meta = {
            "type": "init",
            "session_id": str(session_id),
            "message_id": msg_id
        }
        yield f"data: {json.dumps(init_meta)}\n\n"

        full_answer = []

        if not is_confident:
            fallback = "I could not find this in the documents."
            full_answer.append(fallback)
            yield f"data: {json.dumps({'type': 'token', 'token': fallback})}\n\n"
        else:
            async for token in generate_rag_stream(chat_req.question, active_chunks):
                full_answer.append(token)
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        # Update complete assistant message in database
        final_text = "".join(full_answer)
        try:
            db_update = db.query(Message).filter(Message.id == UUID(msg_id)).first()
            if db_update:
                db_update.content = final_text
                db.commit()
        except Exception:
            pass

        # Send final citations event
        citations_payload = {
            "type": "citations",
            "citations": citations
        }
        yield f"data: {json.dumps(citations_payload)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")

@router.get("/chat/sessions", response_model=List[SessionResponse])
def get_user_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    return sessions

@router.get("/chat/sessions/{session_id}", response_model=List[MessageResponse])
def get_session_messages(session_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session.messages

