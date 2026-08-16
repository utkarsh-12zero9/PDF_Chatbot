from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

class ChunkingService:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", " ", ""]
        )

    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """
        Splits LangChain Document objects into overlapping chunks, preserving metadata.
        Filters out empty documents and ensures at least 1 chunk is generated for non-empty text.
        """
        non_empty_docs = [doc for doc in documents if doc.page_content and doc.page_content.strip()]
        if not non_empty_docs:
            return []

        chunked_docs = self.splitter.split_documents(non_empty_docs)
        
        # Fallback: If splitter returned empty list despite valid text, use original non-empty docs
        if not chunked_docs:
            chunked_docs = non_empty_docs

        # Enrich metadata with chunk_id and size
        for idx, doc in enumerate(chunked_docs):
            doc.metadata["chunk_id"] = idx
            doc.metadata["chunk_size"] = len(doc.page_content)
        
        return chunked_docs

    def format_chunks_summary(self, chunked_docs: List[Document]) -> List[Dict[str, Any]]:
        """
        Formats chunk objects for frontend JSON serialization.
        """
        chunks_summary = []
        for doc in chunked_docs:
            chunks_summary.append({
                "chunk_id": doc.metadata.get("chunk_id", 0),
                "page": doc.metadata.get("page", 0) + 1 if isinstance(doc.metadata.get("page"), int) else doc.metadata.get("page_number", 1),
                "character_count": len(doc.page_content),
                "content": doc.page_content
            })
        return chunks_summary

chunking_service = ChunkingService(chunk_size=1000, chunk_overlap=200)
