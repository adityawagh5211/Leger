"""
AI Router — streams responses from a fallback chain of free-tier AI providers:
Groq -> Cerebras -> Gemini -> OpenRouter.
"""

import os
from collections.abc import AsyncIterator
import logging

from ..config import settings

logger = logging.getLogger("ledger.ai_router")


class AIProviderAuthError(RuntimeError):
    def __init__(self, provider: str, status_code: int | None, detail: str):
        self.provider = provider
        self.status_code = status_code
        super().__init__(f"{provider} authentication failed ({status_code or 'unknown'}): {detail}")


def _status_code(exc: Exception) -> int | None:
    status = getattr(exc, "status_code", None)
    if status:
        return int(status)
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    return int(status) if status else None

class GroqAdapter:
    """Calls Groq API using official SDK."""
    async def is_available(self) -> bool:
        return bool(settings.groq_api_key)

    async def stream(self, system: str, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.groq_api_key)
        
        # Groq expects system message as first message
        formatted_messages = [{"role": "system", "content": system}] + messages
        
        stream = await client.chat.completions.create(
            messages=formatted_messages,
            model="llama-3.1-8b-instant",
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

class CerebrasAdapter:
    """Calls Cerebras API using OpenAI compatible SDK."""
    async def is_available(self) -> bool:
        return bool(settings.cerebras_api_key)

    async def stream(self, system: str, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            base_url="https://api.cerebras.ai/v1",
            api_key=settings.cerebras_api_key
        )
        
        formatted_messages = [{"role": "system", "content": system}] + messages
        
        stream = await client.chat.completions.create(
            messages=formatted_messages,
            model="llama-3.3-70b",
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

class GeminiAdapter:
    """Calls Google Gemini API."""
    async def is_available(self) -> bool:
        return bool(settings.gemini_api_key)

    async def stream(self, system: str, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        
        model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=system)
        
        # Convert messages to Gemini format
        formatted_messages = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            formatted_messages.append({"role": role, "parts": [msg["content"]]})
            
        response = await model.generate_content_async(
            formatted_messages,
            stream=True,
            generation_config=genai.types.GenerationConfig(max_output_tokens=max_tokens)
        )
        
        async for chunk in response:
            if chunk.text:
                yield chunk.text

class CohereAdapter:
    """Calls Cohere API."""
    async def is_available(self) -> bool:
        return bool(settings.cohere_api_key)

    async def stream(self, system: str, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
        import cohere
        client = cohere.AsyncClient(api_key=settings.cohere_api_key)
        
        chat_history = []
        message = ""
        for msg in messages:
            if msg["role"] == "user":
                message = msg["content"]
            else:
                chat_history.append({"role": "USER" if msg["role"] == "user" else "CHATBOT", "message": msg["content"]})
                
        response = await client.chat_stream(
            message=message,
            preamble=system,
            chat_history=chat_history,
            max_tokens=max_tokens,
            model="command-r-plus-08-2024" # Cohere's free tier model
        )
        
        async for event in response:
            if event.event_type == "text-generation":
                yield event.text

class OpenRouterAdapter:
    """Calls OpenRouter API using OpenAI compatible SDK."""
    async def is_available(self) -> bool:
        return bool(settings.openrouter_api_key)

    async def stream(self, system: str, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key
        )
        
        formatted_messages = [{"role": "system", "content": system}] + messages
        
        # Using a free model on OpenRouter, e.g., meta-llama/llama-3-8b-instruct:free
        stream = await client.chat.completions.create(
            messages=formatted_messages,
            model="meta-llama/llama-3-8b-instruct:free", 
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class AIRouter:
    """Routes AI requests: Groq -> Cerebras -> Gemini -> OpenRouter."""

    def __init__(self):
        self.adapters = [
            ("Groq", GroqAdapter()),
            ("Cerebras", CerebrasAdapter()),
            ("Gemini", GeminiAdapter()),
            ("Cohere", CohereAdapter()),
            ("OpenRouter", OpenRouterAdapter())
        ]

    async def stream(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
        prefer_local: bool = False, # Kept for signature compatibility
    ) -> AsyncIterator[str]:
        
        last_error = None
        for name, adapter in self.adapters:
            if await adapter.is_available():
                try:
                    logger.debug(f"Attempting stream with {name}")
                    
                    # Try to start stream and get first token
                    iterator = adapter.stream(system, messages, max_tokens)
                    try:
                        first_token = await anext(iterator)
                    except StopAsyncIteration:
                        first_token = ""
                    
                    yield first_token
                    
                    # If we got here, connection succeeded, yield the rest
                    async for token in iterator:
                        yield token
                        
                    return # Successfully completed the stream, stop fallback
                    
                except Exception as e:
                    status = _status_code(e)
                    if status in (401, 403):
                        logger.error("%s adapter authentication failed status=%s error=%s", name, status, e)
                        last_error = AIProviderAuthError(name, status, str(e))
                    else:
                        logger.warning("%s adapter failed status=%s error=%s", name, status, e)
                        last_error = e
                    continue

        if last_error:
            if isinstance(last_error, AIProviderAuthError):
                yield "\n[AI Service Error: AI provider authentication failed. Check the configured API keys.]"
            else:
                yield f"\\n[AI Service Error: All providers failed. Last error: {str(last_error)}]"
        else:
            yield "\\n[AI Service Error: No API keys configured.]"

ai_router = AIRouter()
