import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database.db import get_db
from backend.services.pdf_loader import pdf_loader_service
from backend.services.memory import memory_service

router = APIRouter(prefix="/api", tags=["upload"])

@router.post("/upload")
async def upload_pdf_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided.")
    
    filename_lower = file.filename.lower() if file.filename else ""
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".txt")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .pdf or .txt file.")
    # 1. Save file to backend storage
    saved_path, pdf_id = pdf_loader_service.save_pdf(file)

    # 2. Parse PDF, split into chunks, embed, and store in FAISS vector store
    extracted_data = pdf_loader_service.process_and_index_pdf(
        file_path=saved_path,
        pdf_id=pdf_id,
        original_filename=file.filename
    )

    # 3. Persist PDF metadata in SQL `pdfs` table
    pdf_record = memory_service.record_pdf(
        db=db,
        pdf_id=pdf_id,
        filename=file.filename,
        vector_store_path=os.path.join("backend/storage/vector_store", pdf_id)
    )

    # 4. Create new chat session in SQL `chat_sessions` table
    chat_session = memory_service.get_or_create_session(db=db, pdf_id=pdf_id)

    extracted_data["session_id"] = chat_session.id

    return {
        "status": "success",
        "message": "PDF uploaded, indexed in FAISS, and session created in database successfully.",
        "data": extracted_data
    }
