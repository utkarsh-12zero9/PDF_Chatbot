from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database.db import get_db
from backend.services.memory import memory_service

router = APIRouter(prefix="/api", tags=["sessions"])

@router.get("/sessions")
def list_sessions_endpoint(db: Session = Depends(get_db)):
    """
    Returns list of all active/past chat sessions with associated PDF details.
    """
    sessions = memory_service.list_user_sessions(db)
    return {
        "status": "success",
        "data": sessions
    }

@router.get("/sessions/{session_id}/messages")
def get_session_messages_endpoint(session_id: str, db: Session = Depends(get_db)):
    """
    Returns full message transcript for a given chat session.
    """
    messages = memory_service.get_session_messages(db, session_id)
    return {
        "status": "success",
        "session_id": session_id,
        "data": messages
    }

@router.delete("/sessions/{session_id}")
def delete_session_endpoint(session_id: str, db: Session = Depends(get_db)):
    """
    Deletes a specified chat session and its saved message transcript.
    """
    success = memory_service.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "status": "success",
        "message": f"Session {session_id} deleted successfully."
    }
