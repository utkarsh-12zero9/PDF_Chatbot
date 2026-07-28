from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database.db import init_db
from backend.routers.chat import router as chat_router
from backend.routers.upload import router as upload_router
from backend.routers.session import router as session_router

# Initialize database tables on application startup
init_db()

app = FastAPI(
    title="PDF Chatbot API",
    description="FastAPI Backend for RAG PDF Chatbot with Conversational Memory & Database Persistence",
    version="0.9.0"
)

# CORS setup for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(upload_router)
app.include_router(session_router)

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "PDF Chatbot API",
        "version": "0.9.0"
    }
