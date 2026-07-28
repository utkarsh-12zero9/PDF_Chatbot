import os
import asyncio
from typing import AsyncGenerator, Optional, List, Dict
from dotenv import load_dotenv

class LLMService:
    def stream_rag_response(
        self,
        user_query: str,
        context_str: Optional[str] = None,
        system_instruction: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Streams response tokens using structured system and user messages.
        Loads environment variables from backend/.env dynamically on every request.
        """
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        if os.path.exists(env_path):
            load_dotenv(dotenv_path=env_path, override=True)
        else:
            load_dotenv(override=True)

        provider = os.getenv("MODEL_PROVIDER", "huggingface").strip().lower()
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        hf_token = os.getenv("HUGGINGFACEHUB_API_TOKEN", "").strip()
        hf_model = os.getenv("HUGGINGFACE_MODEL", "Qwen/Qwen2.5-7B-Instruct").strip()

        default_system = (
            "You are an expert AI assistant answering questions STRICTLY based on the provided PDF document excerpts.\n"
            "Instructions:\n"
            "1. Answer the question accurately using ONLY the information in the Document Context.\n"
            "2. If the context does not contain enough information to answer, politely respond: "
            "'I could not find the answer to that question in the uploaded PDF.'\n"
            "3. Cite source page numbers when referencing specific details.\n"
            "4. Output ONLY your final answer. Do NOT output prompt instructions or context blocks."
        )
        system_text = system_instruction or default_system

        if context_str:
            user_content = f"DOCUMENT CONTEXT:\n{context_str}\n\nUSER QUESTION: {user_query}"
        else:
            user_content = user_query

        messages = [
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_content}
        ]

        if provider == "openai" and openai_key:
            return self._stream_openai_messages(messages, openai_key, user_query)
        elif (provider in ["huggingface", "hf"]) and hf_token:
            return self._stream_huggingface_messages(messages, hf_token, hf_model, user_query)
        else:
            return self._stream_mock_response(user_query)

    async def _stream_openai_messages(
        self, messages: List[Dict[str, str]], openai_key: str, user_query: str
    ) -> AsyncGenerator[str, None]:
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            
            model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            llm = ChatOpenAI(
                model=model_name,
                openai_api_key=openai_key,
                streaming=True
            )
            langchain_msgs = []
            for m in messages:
                if m["role"] == "system":
                    langchain_msgs.append(SystemMessage(content=m["content"]))
                else:
                    langchain_msgs.append(HumanMessage(content=m["content"]))

            async for chunk in llm.astream(langchain_msgs):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            yield f"[OpenAI API Error: {str(e)}]\n\n"
            async for chunk in self._stream_mock_response(user_query):
                yield chunk

    async def _stream_huggingface_messages(
        self, messages: List[Dict[str, str]], hf_token: str, hf_model: str, user_query: str
    ) -> AsyncGenerator[str, None]:
        try:
            from huggingface_hub import InferenceClient

            client = InferenceClient(token=hf_token)
            
            stream = client.chat_completion(
                messages=messages,
                model=hf_model,
                max_tokens=800,
                stream=True
            )

            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    yield token
                    await asyncio.sleep(0.01)

        except Exception as e:
            yield f"[Hugging Face Model Error: {str(e)}]\n\n"
            async for chunk in self._stream_mock_response(user_query):
                yield chunk

    async def _stream_mock_response(self, user_query: str) -> AsyncGenerator[str, None]:
        """
        Clean mock response stream. Only outputs clean answer text without prompt templates.
        """
        mock_response = (
            f"Regarding your question ('{user_query}'): "
            "The model response engine is ready. "
            "To connect live cloud models, verify `OPENAI_API_KEY` or `HUGGINGFACEHUB_API_TOKEN` in `backend/.env`."
        )
        words = mock_response.split(" ")
        for i, word in enumerate(words):
            suffix = " " if i < len(words) - 1 else ""
            yield word + suffix
            await asyncio.sleep(0.03)

llm_service = LLMService()
