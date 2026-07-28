from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers.chat import router as chat_router
from backend.routers.upload import router as upload_router

app = FastAPI(
    title="PDF Chatbot API",
    description="FastAPI Backend for RAG PDF Chatbot with Conversational Memory",
    version="0.2.0"
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

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "PDF Chatbot API",
        "version": "0.2.0"
    }
