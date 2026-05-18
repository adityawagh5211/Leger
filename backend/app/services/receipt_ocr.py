"""
Receipt OCR — extract transaction data from receipt images.
Uses Anthropic Claude 3.5 Sonnet Vision capabilities to extract and structure data in one step.
"""

import base64
import json
import logging
from datetime import date
from decimal import Decimal
import asyncio
import httpx
import re

from ..config import settings
from .categorizer import categorize

logger = logging.getLogger("ledger.receipt")

EXTRACTION_PROMPT = """Extract the following information from this receipt image:
- merchant_name: string
- date: YYYY-MM-DD (if visible, else null)
- total_amount: number (the total/grand total)
- items: list of {name: string, price: number} (top 5 items max)
- category: one of [Dining, Groceries, Shopping, Health, Transport, Utilities, Entertainment, Subscriptions, Housing, Other]

Return ONLY valid JSON. No explanation."""

async def parse_receipt_image(image_bytes: bytes) -> dict | None:
    """
    Parse a receipt image into structured transaction data.
    Uses Anthropic Claude 3.5 Sonnet Vision capabilities.
    """
    if not settings.anthropic_api_key:
        logger.warning("No Anthropic API key found. Cannot parse receipt image.")
        return None

    logger.info("Sending receipt image to Anthropic for extraction...")
    
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    payload = {
        "model": "claude-3-5-sonnet-latest",
        "max_tokens": 512,
        "system": EXTRACTION_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64_image
                        }
                    },
                    {
                        "type": "text",
                        "text": "Parse this receipt and return the JSON."
                    }
                ]
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            
            output_text = data["content"][0]["text"]
            
            # Extract JSON block if surrounded by markdown codeblocks
            json_match = re.search(r'\{.*\}', output_text.replace('\n', ' '), re.DOTALL)
            if json_match:
                raw = json_match.group(0)
            else:
                raw = output_text
                
            parsed_data = json.loads(raw)

            # Validate required fields
            amount = parsed_data.get("total_amount")
            if not amount or float(amount) <= 0:
                return None

            merchant = parsed_data.get("merchant_name", "Unknown")
            category = parsed_data.get("category", "Other")
            parsed_date = None
            if parsed_data.get("date"):
                try:
                    parsed_date = date.fromisoformat(parsed_data["date"])
                except ValueError:
                    pass

            return {
                "description": merchant,
                "amount": Decimal(str(amount)),
                "category": category
                if category
                in [
                    "Dining",
                    "Groceries",
                    "Shopping",
                    "Health",
                    "Transport",
                    "Utilities",
                    "Entertainment",
                    "Subscriptions",
                    "Housing",
                    "Other",
                ]
                else categorize(merchant, "expense"),
                "date": parsed_date or date.today(),
                "type": "expense",
                "source": "receipt",
                "items": parsed_data.get("items", []),
                "merchant_normalized": merchant,
                "confidence": 0.8,
            }
            
    except (json.JSONDecodeError, KeyError, httpx.HTTPError) as e:
        logger.warning("Anthropic extraction failed or returned invalid JSON: %s", e)
        return None
