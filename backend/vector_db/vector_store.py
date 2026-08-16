import os
from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from backend.services.embedding import embedding_service
from dotenv import load_dotenv

load_dotenv()

class VectorStoreManager:
    def __init__(self, storage_dir: str = "backend/storage/vector_store"):
        self.storage_dir = storage_dir
        self.vector_db_type = os.getenv("VECTOR_DB_TYPE", "faiss").lower()
        os.makedirs(self.storage_dir, exist_ok=True)

    def _get_store_path(self, pdf_id: str) -> str:
        return os.path.join(self.storage_dir, pdf_id)

    def create_vector_index(self, documents: List[Document], pdf_id: str) -> Dict[str, Any]:
        """
        Generates vector embeddings for doc chunks and indexes them using FAISS.
        Saves index locally to backend/storage/vector_store/{pdf_id}.
        """
        if not documents:
            raise ValueError("No document chunks provided for vector indexing.")

        embeddings = embedding_service.get_embeddings()
        store_path = self._get_store_path(pdf_id)

        if self.vector_db_type == "faiss":
            from langchain_community.vectorstores import FAISS
            vector_store = FAISS.from_documents(documents, embeddings)
            vector_store.save_local(store_path)

            return {
                "pdf_id": pdf_id,
                "vector_db": "faiss",
                "indexed_chunks": len(documents),
                "store_path": store_path
            }
        elif self.vector_db_type == "pinecone":
            pinecone_key = os.getenv("PINECONE_API_KEY", "").strip()
            index_name = os.getenv("PINECONE_INDEX_NAME", "pdf-chatbot-index")
            if not pinecone_key:
                raise ValueError("PINECONE_API_KEY is not set in backend/.env")

            from langchain_community.vectorstores import Pinecone as PineconeVectorStore
            import pinecone
            pinecone.init(api_key=pinecone_key, environment=os.getenv("PINECONE_ENV", "us-west1-gcp"))
            
            vector_store = PineconeVectorStore.from_documents(
                documents,
                embeddings,
                index_name=index_name,
                namespace=pdf_id
            )
            return {
                "pdf_id": pdf_id,
                "vector_db": "pinecone",
                "indexed_chunks": len(documents),
                "index_name": index_name
            }
        else:
            raise ValueError(f"Unsupported VECTOR_DB_TYPE: {self.vector_db_type}")

    def get_vector_store(self, pdf_id: str):
        """
        Loads saved FAISS vector store index for a given PDF ID.
        """
        store_path = self._get_store_path(pdf_id)
        if not os.path.exists(store_path):
            return None

        embeddings = embedding_service.get_embeddings()
        if self.vector_db_type == "faiss":
            from langchain_community.vectorstores import FAISS
            return FAISS.load_local(
                store_path,
                embeddings,
                allow_dangerous_deserialization=True
            )
        return None

    def similarity_search(self, query: str, pdf_id: str, k: int = 4) -> List[Document]:
        """
        Performs similarity search over top-K relevant chunks (K=4 to 6).
        """
        vector_store = self.get_vector_store(pdf_id)
        if not vector_store:
            return []
        return vector_store.similarity_search(query, k=k)

vector_store_manager = VectorStoreManager()
