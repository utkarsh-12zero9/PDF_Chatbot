import os
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        self.provider = os.getenv("EMBEDDING_PROVIDER", "huggingface").lower()
        self.embeddings_instance = None
        self._init_embeddings()

    def _init_embeddings(self):
        if self.provider == "openai":
            openai_key = os.getenv("OPENAI_API_KEY", "").strip()
            if openai_key:
                try:
                    from langchain_openai import OpenAIEmbeddings
                    model_name = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
                    self.embeddings_instance = OpenAIEmbeddings(
                        model=model_name,
                        openai_api_key=openai_key
                    )
                    return
                except Exception as e:
                    print(f"Warning: Could not initialize OpenAIEmbeddings ({e}). Falling back to HuggingFace Embeddings.")

        # Default / Fallback: Free local Hugging Face all-MiniLM-L6-v2 embeddings
        try:
            from langchain_huggingface import HuggingFaceEmbeddings
            model_name = os.getenv("HUGGINGFACE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
            self.embeddings_instance = HuggingFaceEmbeddings(model_name=model_name)
        except Exception as e:
            try:
                from langchain_community.embeddings import HuggingFaceEmbeddings
                model_name = os.getenv("HUGGINGFACE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
                self.embeddings_instance = HuggingFaceEmbeddings(model_name=model_name)
            except Exception as ex:
                raise RuntimeError(f"Failed to initialize embedding model: {str(ex)}")

    def get_embeddings(self):
        if self.embeddings_instance is None:
            self._init_embeddings()
        return self.embeddings_instance

embedding_service = EmbeddingService()
