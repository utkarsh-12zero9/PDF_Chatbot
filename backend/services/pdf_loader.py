import os
import shutil
import uuid
from typing import Dict, Any, List
from fastapi import UploadFile, HTTPException
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
from backend.services.chunking import chunking_service
from backend.vector_db.vector_store import vector_store_manager

class PDFLoaderService:
    def __init__(self, upload_dir: str = "backend/storage/uploads"):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def save_pdf(self, file: UploadFile) -> tuple[str, str]:
        """
        Validates and saves uploaded PDF to backend storage directory.
        Returns (saved_path, pdf_id).
        """
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files (.pdf) are supported.")
        
        pdf_id = f"pdf_{uuid.uuid4().hex[:10]}"
        safe_filename = f"{pdf_id}_{os.path.basename(file.filename)}"
        dest_path = os.path.join(self.upload_dir, safe_filename)

        try:
            with open(dest_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return dest_path, pdf_id
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save PDF file: {str(e)}")

    def process_and_index_pdf(self, file_path: str, pdf_id: str, original_filename: str) -> Dict[str, Any]:
        """
        Dual-Engine PDF Ingestion & Indexing Pipeline:
        1. Primary Engine: PyPDFLoader.
        2. Fallback Engine: pdfplumber (for complex/layout PDFs).
        3. RecursiveCharacterTextSplitter chunking (1000 size, 200 overlap).
        4. FAISS Vector Embedding & Indexing.
        """
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="PDF file not found on server.")

        try:
            # 1. Try PyPDFLoader
            loader = PyPDFLoader(file_path)
            documents = loader.load()

            # Check if PyPDFLoader extracted text
            valid_docs = [doc for doc in documents if doc.page_content and doc.page_content.strip()]

            # 2. Fallback to pdfplumber if PyPDFLoader yielded no extractable text
            if not valid_docs:
                try:
                    import pdfplumber
                    pdfplumber_docs = []
                    with pdfplumber.open(file_path) as pdf:
                        for i, page in enumerate(pdf.pages):
                            page_text = page.extract_text() or ""
                            if page_text.strip():
                                pdfplumber_docs.append(
                                    Document(
                                        page_content=page_text.strip(),
                                        metadata={"source": file_path, "page": i}
                                    )
                                )
                    if pdfplumber_docs:
                        documents = pdfplumber_docs
                        valid_docs = pdfplumber_docs
                except Exception as ex:
                    print(f"pdfplumber fallback notice: {ex}")

            total_pages = len(documents)
            if total_pages == 0 or not valid_docs:
                raise HTTPException(
                    status_code=400,
                    detail="The uploaded PDF contains no extractable text. If this is an image/scanned document, an OCR layer is required."
                )

            # Attach metadata
            for doc in valid_docs:
                doc.metadata["pdf_id"] = pdf_id
                doc.metadata["filename"] = original_filename

            # 3. Chunking
            chunked_docs = chunking_service.chunk_documents(valid_docs)
            if not chunked_docs:
                raise HTTPException(
                    status_code=400,
                    detail="Could not generate text chunks from the PDF file."
                )

            chunks_summary = chunking_service.format_chunks_summary(chunked_docs)

            # 4. Vector Embedding & FAISS Indexing
            vector_index_result = vector_store_manager.create_vector_index(chunked_docs, pdf_id)

            full_text = ""
            pages_data: List[Dict[str, Any]] = []

            for i, doc in enumerate(documents):
                page_content = doc.page_content.strip()
                pages_data.append({
                    "page_number": i + 1,
                    "character_count": len(page_content),
                    "content": page_content
                })
                if page_content:
                    full_text += f"\n--- Page {i + 1} ---\n" + page_content

            preview_text = full_text[:400].strip() + ("..." if len(full_text) > 400 else "")

            return {
                "pdf_id": pdf_id,
                "filename": original_filename,
                "file_path": file_path,
                "total_pages": total_pages,
                "total_characters": len(full_text),
                "total_chunks": len(chunked_docs),
                "chunk_size": chunking_service.chunk_size,
                "chunk_overlap": chunking_service.chunk_overlap,
                "vector_db": vector_index_result.get("vector_db", "faiss"),
                "indexed_vectors": vector_index_result.get("indexed_chunks", len(chunked_docs)),
                "preview_text": preview_text,
                "chunks": chunks_summary,
                "pages": pages_data
            }
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Error in PDF RAG pipeline: {str(e)}")

pdf_loader_service = PDFLoaderService()
