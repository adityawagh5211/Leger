import logging
import asyncio
from typing import AsyncIterator

from ..config import settings

logger = logging.getLogger("ledger.ai.llama")

class LlamaEngine:
    """
    Singleton wrapper around llama-cpp-python.
    Lazily loads the model into memory only when first requested.
    """
    _instance = None
    _llm = None
    _loading_lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def _get_model(self):
        """Lazily load the model."""
        if not settings.llama_enabled:
            return None

        if self._llm is not None:
            return self._llm

        async with self._loading_lock:
            # Double-check inside lock
            if self._llm is not None:
                return self._llm

            try:
                # Import here so it doesn't crash the server if library is missing
                from llama_cpp import Llama
                
                logger.info("Loading llama-cpp-python model into memory from %s", settings.llama_model_path)
                
                # Run the blocking model load in a thread
                def _load():
                    return Llama(
                        model_path=settings.llama_model_path,
                        n_ctx=4096,
                        n_gpu_layers=35, # Use GPU if available
                        verbose=False
                    )
                
                self._llm = await asyncio.to_thread(_load)
                logger.info("Llama model loaded successfully.")
                return self._llm
            except ImportError:
                logger.warning("llama-cpp-python is not installed.")
                return None
            except Exception as e:
                logger.error("Failed to load Llama model: %s", e)
                return None

    async def generate(self, prompt: str, max_tokens: int = 512) -> str | None:
        """Generate a complete text response."""
        llm = await self._get_model()
        if not llm:
            return None

        def _run():
            response = llm.create_chat_completion(
                messages=[
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=0.1
            )
            return response["choices"][0]["message"]["content"]

        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            logger.error("Llama generation failed: %s", e)
            return None

    async def stream(self, system: str, messages: list[dict], max_tokens: int = 512) -> AsyncIterator[str]:
        """Stream chat completion tokens."""
        llm = await self._get_model()
        if not llm:
            return

        def _run_generator():
            formatted_messages = [{"role": "system", "content": system}, *messages]
            return llm.create_chat_completion(
                messages=formatted_messages,
                max_tokens=max_tokens,
                temperature=0.3,
                stream=True
            )

        try:
            # We get the generator in a thread
            generator = await asyncio.to_thread(_run_generator)
            
            # We must iterate over it. Since it's a synchronous generator blocking the thread,
            # we yield from it by advancing it in a thread pool.
            while True:
                try:
                    chunk = await asyncio.to_thread(next, generator)
                    delta = chunk["choices"][0]["delta"]
                    if "content" in delta:
                        yield delta["content"]
                except StopIteration:
                    break
        except Exception as e:
            logger.error("Llama stream failed: %s", e)

llama_engine = LlamaEngine()
