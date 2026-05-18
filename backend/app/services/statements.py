"""
statements.py — Bank statement parser (CSV + PDF).

PDF parsing strategy (in order of preference):
  1. pdfplumber structured table extraction (for digital/text PDFs)
  2. pdfplumber raw text extraction + regex row parser (for text PDFs with no tables)
  3. EasyOCR (for scanned/image-based PDFs — no external binary required)
     pip install easyocr
"""

import logging

import re
import json
import asyncio
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from io import BytesIO, StringIO

import pandas as pd
import pdfplumber
import httpx
import base64

from ..config import settings
from .categorizer import categorize

logger = logging.getLogger("ledger.statements")


def _money(value) -> Decimal:
    cleaned = str(value or "0").replace(",", "").strip()
    if not cleaned or cleaned.lower() == "nan":
        return Decimal("0")
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return Decimal("0")


# ── Structured table parser ───────────────────────────────────────────────────

def _normalize_frame(df: pd.DataFrame) -> list[dict]:
    normalized = {str(c).strip().lower(): c for c in df.columns}
    date_col = next((normalized[c] for c in normalized if "date" in c), None)
    desc_col = next(
        (normalized[c] for c in normalized if c in {"description", "details", "narration", "particulars"}), None
    )
    amount_col = next((normalized[c] for c in normalized if "amount" in c), None)
    debit_col = next((normalized[c] for c in normalized if "debit" in c or "withdraw" in c), None)
    credit_col = next((normalized[c] for c in normalized if "credit" in c or "deposit" in c), None)
    if not date_col or not desc_col or not (amount_col or debit_col or credit_col):
        return []

    rows: list[dict] = []
    for _, row in df.iterrows():
        description = str(row.get(desc_col, "")).strip()
        parsed_date = pd.to_datetime(row.get(date_col), errors="coerce")
        if not description or pd.isna(parsed_date):
            continue

        debit = _money(row.get(debit_col)) if debit_col else Decimal("0")
        credit = _money(row.get(credit_col)) if credit_col else Decimal("0")
        if amount_col:
            raw = _money(row.get(amount_col))
            tx_type = "income" if raw > 0 else "expense"
            amount = abs(raw)
        else:
            tx_type = "income" if credit > 0 else "expense"
            amount = credit if credit > 0 else debit
        if amount <= 0:
            continue
        rows.append(
            {
                "date": parsed_date.date(),
                "type": tx_type,
                "amount": amount,
                "description": description,
                "category": categorize(description, tx_type),
                "source": "statement",
            }
        )
    return rows


# ── Text-based regex row parser ───────────────────────────────────────────────

_DATE_RE = re.compile(
    r"\b(\d{1,2}[\/\-]\d{2}[\/\-]\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{1,2}[A-Za-z]{3}\d{2,4})\b"
)
_AMOUNT_RE = re.compile(r"([0-9,]+\.[0-9]{2})")


def _parse_date_str(s: str) -> "datetime.date | None":
    s = s.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d%b%Y", "%d%b%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_text_rows(text: str) -> list[dict]:
    """Regex row parser for raw text extracted from a PDF."""
    rows: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        date_m = _DATE_RE.search(line)
        if not date_m:
            continue
        tx_date = _parse_date_str(date_m.group(0))
        if not tx_date:
            continue
        amounts = _AMOUNT_RE.findall(line)
        if len(amounts) < 2:
            continue
        rest = line[date_m.end():].strip()
        amount_positions = [m.start() for m in _AMOUNT_RE.finditer(rest)]
        if not amount_positions:
            continue
        description = rest[:amount_positions[0]].strip().strip("-").strip()
        if not description:
            description = "Bank transaction"
        lower_rest = rest.lower()
        is_credit = any(kw in lower_rest for kw in ("by ", "cr ", "credit", "deposit", "salary", "refund"))
        is_debit = any(kw in lower_rest for kw in ("to ", "dr ", "debit", "withdraw", "paid", "transfer"))
        try:
            amount = Decimal(amounts[0].replace(",", ""))
        except InvalidOperation:
            continue
        if amount <= 0:
            continue
        tx_type = "income" if is_credit and not is_debit else "expense"
        rows.append(
            {
                "date": tx_date,
                "type": tx_type,
                "amount": amount,
                "description": description,
                "category": categorize(description, tx_type),
                "source": "statement",
            }
        )
    return rows


# ── Local LLM Vision pipeline for scanned/image PDFs ─────────────────────────

async def _llm_vision_parse_pdf(content: bytes) -> str:
    """
    Render PDF pages to images and use llama.cpp server to extract transaction tables.
    Returns concatenated JSON array output from the model.
    """
    if not settings.llama_enabled:
        return ""
        
    try:
        import pypdfium2 as pdfium
        from io import BytesIO
    except ImportError:
        logger.warning("Required image/pdf processing libraries not available.")
        return ""

    texts: list[str] = []
    try:
        doc = pdfium.PdfDocument(content)
    except Exception as e:
        logger.warning("pypdfium2 failed to open PDF: %s", e)
        return ""

    async with httpx.AsyncClient(timeout=60) as client:
        for i, page in enumerate(doc):
            try:
                scale = 200 / 72
                bitmap = page.render(scale=scale, rotation=0)
                pil_image = bitmap.to_pil()
                
                buf = BytesIO()
                pil_image.save(buf, format="JPEG")
                b64 = base64.b64encode(buf.getvalue()).decode()

                res = await client.post(
                    f"{settings.llama_server_url}/v1/chat/completions",
                    json={
                        "model": "qwen2-vl",
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                                    {
                                        "type": "text", 
                                        "text": "Extract the bank transactions from this image into a JSON list. "
                                                "Each object must have: date (YYYY-MM-DD), description, amount (absolute number without commas), type (income or expense). "
                                                "If there are no transactions, return an empty array []. Return ONLY valid JSON."
                                    },
                                ],
                            }
                        ],
                        "max_tokens": 1024,
                    },
                )
                res.raise_for_status()
                output_text = res.json()["choices"][0]["message"]["content"]
                
                json_match = re.search(r'\[.*\]', output_text.replace('\n', ' '), re.DOTALL)
                if json_match:
                    texts.append(json_match.group(0))
                else:
                    texts.append(output_text)
                    
                logger.debug("llama.cpp vision page %d processed", i + 1)
            except Exception as e:
                logger.warning("llama.cpp Vision failed on page %d: %s", i + 1, e)

    doc.close()
    return "\n".join(texts)



# ── Public parsers ────────────────────────────────────────────────────────────

def parse_csv(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")
    return _normalize_frame(pd.read_csv(StringIO(text)))


async def parse_pdf(content: bytes) -> list[dict]:
    rows: list[dict] = []
    full_text_lines: list[str] = []
    has_any_text = False

    with pdfplumber.open(BytesIO(content)) as pdf:
        for page in pdf.pages:
            # ── 1. Structured table extraction ──
            for table in page.extract_tables() or []:
                if len(table) < 2:
                    continue
                non_empty = sum(1 for row in table for cell in row if cell and str(cell).strip())
                if non_empty > 4:
                    rows.extend(_normalize_frame(pd.DataFrame(table[1:], columns=table[0])))

            # ── Collect page text ──
            text = page.extract_text(x_tolerance=3, y_tolerance=3)
            if text and text.strip():
                has_any_text = True
                full_text_lines.append(text)

    # ── 2. Text-regex fallback (text PDF, no well-formed tables) ──
    if not rows and has_any_text:
        logger.info("PDF: no structured tables found, trying text-regex parser")
        rows = _parse_text_rows("\n".join(full_text_lines))

    # ── 3. OCR fallback (image-based / scanned PDF) ──
    if not rows and not has_any_text:
        logger.info("PDF appears to be image-based, attempting LLM Vision parsing")
        ocr_json_str = await _llm_vision_parse_pdf(content)
        
        if ocr_json_str.strip():
            try:
                blocks = re.findall(r'\[.*?\]', ocr_json_str.replace('\n', ' '), re.DOTALL)
                for block in blocks:
                    items = json.loads(block)
                    if isinstance(items, list):
                        for item in items:
                            try:
                                amount = Decimal(str(item.get("amount", "0")).replace(",", ""))
                                if amount <= 0: continue
                                
                                tx_date = _parse_date_str(str(item.get("date", ""))) or date.today()
                                
                                rows.append({
                                    "date": tx_date,
                                    "type": item.get("type", "expense").lower(),
                                    "amount": amount,
                                    "description": item.get("description", "Bank transaction"),
                                    "category": categorize(item.get("description", ""), item.get("type", "expense").lower()),
                                    "source": "statement",
                                })
                            except Exception:
                                pass
            except Exception as e:
                logger.warning("Failed to parse LLM JSON output: %s", e)
                # Fallback to regex if JSON extraction fails but text was returned
                rows = _parse_text_rows(ocr_json_str)

            if not rows:
                logger.warning("LLM extracted text but no transactions found.")
        else:
            logger.warning(
                "PDF is image-based and LLM Vision returned no text. "
                "Ensure transformers and qwen-vl-utils are installed."
            )

    return rows
