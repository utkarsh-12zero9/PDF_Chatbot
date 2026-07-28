from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.services.pdf_loader import pdf_loader_service

router = APIRouter(prefix="/api", tags=["upload"])

@router.post("/upload")
async def upload_pdf_endpoint(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided.")
    
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .pdf file.")

    # 1. Save file to backend storage
    saved_path, pdf_id = pdf_loader_service.save_pdf(file)

    # 2. Parse PDF, split into chunks, embed, and store in FAISS vector store
    extracted_data = pdf_loader_service.process_and_index_pdf(
        file_path=saved_path,
        pdf_id=pdf_id,
        original_filename=file.filename
    )

    return {
        "status": "success",
        "message": "PDF uploaded, parsed, chunked, and indexed in FAISS vector database successfully.",
        "data": extracted_data
    }
