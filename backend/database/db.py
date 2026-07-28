import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=env_path, override=True)

# Default to local SQLite DB at backend/database/app.db
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./backend/database/app.db").strip()

# Create database directory if using SQLite
if DB_URL.startswith("sqlite"):
    db_dir = os.path.abspath(os.path.join(os.path.dirname(__file__)))
    os.makedirs(db_dir, exist_ok=True)
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DB_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    FastAPI dependency yielding a database session context.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initializes all SQL database tables.
    """
    from backend.database.models import UserModel, PDFModel, ChatSessionModel, MessageModel
    Base.metadata.create_all(bind=engine)
