import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database.models import UserModel, PDFModel, ChatSessionModel, MessageModel

DEFAULT_USER_ID = "default_user"

class MemoryService:
    def ensure_default_user(self, db: Session) -> UserModel:
        """
        Ensures a default user exists in the `users` table for pre-auth phases.
        """
        user = db.query(UserModel).filter(UserModel.id == DEFAULT_USER_ID).first()
        if not user:
            user = UserModel(
                id=DEFAULT_USER_ID,
                name="Default User",
                email="user@local"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    def record_pdf(self, db: Session, pdf_id: str, filename: str, vector_store_path: str, user_id: str = DEFAULT_USER_ID) -> PDFModel:
        """
        Records uploaded PDF metadata in the `pdfs` table.
        """
        self.ensure_default_user(db)
        pdf = db.query(PDFModel).filter(PDFModel.id == pdf_id).first()
        if not pdf:
            pdf = PDFModel(
                id=pdf_id,
                user_id=user_id,
                filename=filename,
                vector_store_path=vector_store_path
            )
            db.add(pdf)
            db.commit()
            db.refresh(pdf)
        return pdf

    def get_or_create_session(self, db: Session, pdf_id: str, session_id: Optional[str] = None, user_id: str = DEFAULT_USER_ID) -> ChatSessionModel:
        """
        Retrieves an existing chat session or creates a new one in `chat_sessions`.
        """
        self.ensure_default_user(db)
        
        if session_id:
            session_obj = db.query(ChatSessionModel).filter(ChatSessionModel.id == session_id).first()
            if session_obj:
                return session_obj

        # Create new session if not found or not provided
        new_session_id = session_id or f"session_{uuid.uuid4().hex[:10]}"
        session_obj = ChatSessionModel(
            id=new_session_id,
            user_id=user_id,
            pdf_id=pdf_id
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)
        return session_obj

    def save_message(self, db: Session, session_id: str, role: str, content: str) -> MessageModel:
        """
        Saves a single message (user question or assistant answer) to `messages` table.
        """
        msg_id = f"msg_{uuid.uuid4().hex[:10]}"
        message = MessageModel(
            id=msg_id,
            session_id=session_id,
            role=role,
            content=content
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message

    def get_recent_history_context(self, db: Session, session_id: str, limit: int = 6) -> str:
        """
        Retrieves recent Q&A messages from database and formats them as conversation memory context.
        """
        messages = (
            db.query(MessageModel)
            .filter(MessageModel.session_id == session_id)
            .order_by(MessageModel.timestamp.desc())
            .limit(limit)
            .all()
        )
        # Reverse to chronological order
        messages.reverse()

        if not messages:
            return ""

        history_blocks = []
        for msg in messages:
            role_label = "User" if msg.role == "user" else "Assistant"
            history_blocks.append(f"{role_label}: {msg.content}")

        return "\n".join(history_blocks)

    def get_session_messages(self, db: Session, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves all messages for a given session formatted for frontend UI rendering.
        Returns ISO timestamps so client browser converts to accurate local time.
        """
        messages = (
            db.query(MessageModel)
            .filter(MessageModel.session_id == session_id)
            .order_by(MessageModel.timestamp.asc())
            .all()
        )
        return [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat() + "Z" if msg.timestamp else ""
            }
            for msg in messages
        ]

    def list_user_sessions(self, db: Session, user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
        """
        Lists all chat sessions for a user with associated PDF details.
        """
        sessions = (
            db.query(ChatSessionModel)
            .filter(ChatSessionModel.user_id == user_id)
            .order_by(ChatSessionModel.id.desc())
            .all()
        )
        result = []
        for s in sessions:
            result.append({
                "session_id": s.id,
                "pdf_id": s.pdf_id,
                "filename": s.pdf.filename if s.pdf else "Unknown PDF",
                "message_count": len(s.messages)
            })
        return result

    def delete_session(self, db: Session, session_id: str) -> bool:
        """
        Deletes a chat session and all associated messages from the database.
        If session does not exist in DB, returns True for clean UI removal.
        """
        session_obj = db.query(ChatSessionModel).filter(ChatSessionModel.id == session_id).first()
        if session_obj:
            db.query(MessageModel).filter(MessageModel.session_id == session_id).delete()
            db.delete(session_obj)
            db.commit()
        return True

memory_service = MemoryService()
