from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.services.llm import llm_service
from backend.services.retriever import retriever_service

router = APIRouter(prefix="/api", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    pdf_id: Optional[str] = None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    query = request.message.strip() if request.message else ""
    if not query:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    context_str: Optional[str] = None

    # If active pdf_id is present, perform RAG retrieval (Top-K = 4 to 6 similarity search)
    if request.pdf_id:
        retrieved_docs = retriever_service.get_top_k_chunks(query, request.pdf_id, k=4)
        
        if retrieved_docs:
            context_blocks = []
            for doc in retrieved_docs:
                page_num = doc.metadata.get("page", 0) + 1 if isinstance(doc.metadata.get("page"), int) else doc.metadata.get("page_number", 1)
                context_blocks.append(f"[Excerpt from Page {page_num}]:\n{doc.page_content}")

            context_str = "\n\n".join(context_blocks)

    return StreamingResponse(
        llm_service.stream_rag_response(user_query=query, context_str=context_str),
        media_type="text/plain"
    )
