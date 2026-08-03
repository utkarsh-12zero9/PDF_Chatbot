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

        # Default / Fallback: Hugging Face Inference API Embeddings (Zero RAM footprint)
        try:
            from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
            model_name = os.getenv("HUGGINGFACE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
            hf_token = os.getenv("HUGGINGFACEHUB_API_TOKEN", "").strip()
            
            if not hf_token:
                print("Warning: HUGGINGFACEHUB_API_TOKEN is missing. Embeddings may fail or hit strict rate limits.")
                
            self.embeddings_instance = HuggingFaceInferenceAPIEmbeddings(
                api_key=hf_token,
                model_name=model_name
            )
        except Exception as e:
            raise RuntimeError(f"Failed to initialize HuggingFace Inference API embeddings: {str(e)}")

    def get_embeddings(self):
        if self.embeddings_instance is None:
            self._init_embeddings()
        return self.embeddings_instance

embedding_service = EmbeddingService()
