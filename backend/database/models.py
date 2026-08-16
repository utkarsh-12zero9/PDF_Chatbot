from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.database.db import Base

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)

    pdfs = relationship("PDFModel", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSessionModel", back_populates="user", cascade="all, delete-orphan")


class PDFModel(Base):
    __tablename__ = "pdfs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    vector_store_path = Column(String, nullable=False)

    user = relationship("UserModel", back_populates="pdfs")
    chat_sessions = relationship("ChatSessionModel", back_populates="pdf", cascade="all, delete-orphan")


class ChatSessionModel(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    pdf_id = Column(String, ForeignKey("pdfs.id"), nullable=False)

    user = relationship("UserModel", back_populates="chat_sessions")
    pdf = relationship("PDFModel", back_populates="chat_sessions")
    messages = relationship("MessageModel", back_populates="session", cascade="all, delete-orphan")


class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSessionModel", back_populates="messages")
