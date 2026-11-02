from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Feedback, Message, User
from app.schemas.schemas import FeedbackCreate, FeedbackResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/feedback", tags=["Feedback"])

@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    fb_in: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify message exists
    msg = db.query(Message).filter(Message.id == fb_in.message_id).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Check if feedback already submitted by this user for this message
    existing = db.query(Feedback).filter(
        Feedback.message_id == fb_in.message_id,
        Feedback.user_id == current_user.id
    ).first()

    if existing:
        existing.rating = fb_in.rating
        existing.comment = fb_in.comment
        db.commit()
        db.refresh(existing)
        return existing

    feedback = Feedback(
        message_id=fb_in.message_id,
        user_id=current_user.id,
        rating=fb_in.rating,
        comment=fb_in.comment
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback

