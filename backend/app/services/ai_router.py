"""
AI Router — selects local llama.cpp or cloud Anthropic based on availability.
Exposes a unified async streaming interface.
"""

import json
from collections.abc import AsyncIterator

import httpx

from ..config import settings


from .llama_engine import llama_engine

class LocalAdapter:
    """Calls embedded llama-cpp-python engine."""

    async def is_available(self) -> bool:
        if not settings.llama_enabled:
            return False
        # Lazy load check
        model = await llama_engine._get_model()
        return model is not None

    async def stream(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
    ) -> AsyncIterator[str]:
        async for chunk in llama_engine.stream(system, messages, max_tokens):
            yield chunk


class AnthropicAdapter:
    """Calls Anthropic claude-3-5-sonnet with streaming."""

    async def stream(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 600,
    ) -> AsyncIterator[str]:
        if not settings.anthropic_api_key:
            yield "AI advisor requires an API key. Set ANTHROPIC_API_KEY in your .env file."
            return

        payload = {
            "model": "claude-3-5-sonnet-latest",
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data in ("[DONE]", ""):
                        continue
                    try:
                        event = json.loads(data)
                        if event.get("type") == "content_block_delta":
                            yield event["delta"].get("text", "")
                    except (json.JSONDecodeError, KeyError):
                        continue


class AIRouter:
    """Routes AI requests: local llama.cpp first, Anthropic fallback."""

    def __init__(self):
        self.local = LocalAdapter()
        self.cloud = AnthropicAdapter()

    async def stream(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 512,
        prefer_local: bool = True,
    ) -> AsyncIterator[str]:
        if prefer_local and await self.local.is_available():
            try:
                async for token in self.local.stream(system, messages, max_tokens):
                    yield token
                return
            except Exception:
                pass  # Fall through to cloud

        async for token in self.cloud.stream(system, messages, max_tokens):
            yield token


ai_router = AIRouter()
