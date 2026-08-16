from typing import List, Dict, Any
from langchain_core.documents import Document
from backend.vector_db.vector_store import vector_store_manager

class RetrieverService:
    def __init__(self, default_k: int = 4):
        self.default_k = default_k

    def get_top_k_chunks(self, query: str, pdf_id: str, k: int = None) -> List[Document]:
        """
        Similarity search pipeline:
        Question -> Embed Query -> FAISS Cosine Similarity Search -> Top K Chunks (K = 4..6)
        """
        top_k = k if k is not None else self.default_k
        return vector_store_manager.similarity_search(query, pdf_id, k=top_k)

    def format_retrieved_chunks(self, docs: List[Document]) -> List[Dict[str, Any]]:
        formatted = []
        for idx, doc in enumerate(docs):
            formatted.append({
                "rank": idx + 1,
                "content": doc.page_content,
                "metadata": doc.metadata
            })
        return formatted

retriever_service = RetrieverService(default_k=4)
