from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database.db import get_db
from backend.services.llm import llm_service
from backend.services.retriever import retriever_service
from backend.services.memory import memory_service

router = APIRouter(prefix="/api", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    pdf_id: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    query = request.message.strip() if request.message else ""
    if not query:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # 1. Get or create active session
    pdf_id = request.pdf_id
    session_id = request.session_id

    if pdf_id:
        session_obj = memory_service.get_or_create_session(db=db, pdf_id=pdf_id, session_id=session_id)
        session_id = session_obj.id

    # 2. Retrieve recent conversation memory from database
    chat_history_str = ""
    if session_id:
        chat_history_str = memory_service.get_recent_history_context(db=db, session_id=session_id, limit=6)

    # 3. Save user message to database
    if session_id:
        memory_service.save_message(db=db, session_id=session_id, role="user", content=query)

    # 4. Perform vector similarity retrieval if PDF active
    context_str: Optional[str] = None
    if pdf_id:
        retrieved_docs = retriever_service.get_top_k_chunks(query, pdf_id, k=4)
        if retrieved_docs:
            context_blocks = []
            for doc in retrieved_docs:
                page_num = doc.metadata.get("page", 0) + 1 if isinstance(doc.metadata.get("page"), int) else doc.metadata.get("page_number", 1)
                context_blocks.append(f"[Excerpt from Page {page_num}]:\n{doc.page_content}")
            context_str = "\n\n".join(context_blocks)

    # Combine document context with conversational memory
    full_context = ""
    if chat_history_str:
        full_context += f"CONVERSATION HISTORY (Previous Turns):\n{chat_history_str}\n\n"
    if context_str:
        full_context += f"CURRENT DOCUMENT EXCERPTS:\n{context_str}"

    full_context = full_context.strip() if full_context else None

    # 5. Generator wrapper that streams tokens to client AND collects answer to save to SQL DB
    async def response_stream_wrapper():
        full_response_acc = []
        async for chunk in llm_service.stream_rag_response(user_query=query, context_str=full_context):
            full_response_acc.append(chunk)
            yield chunk
        
        full_answer = "".join(full_response_acc).strip()
        if session_id and full_answer:
            # Create a separate DB session for background save to ensure thread-safety
            from backend.database.db import SessionLocal
            db_bg = SessionLocal()
            try:
                memory_service.save_message(db=db_bg, session_id=session_id, role="assistant", content=full_answer)
            finally:
                db_bg.close()

    return StreamingResponse(
        response_stream_wrapper(),
        media_type="text/plain"
    )
