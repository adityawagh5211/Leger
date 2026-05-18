import sys
import asyncio
sys.path.insert(0, ".")

import logging
logging.basicConfig(level=logging.INFO)
logging.getLogger("pdfminer").setLevel(logging.WARNING)

from app.services.statements import parse_pdf

async def main():
    print("Loading page of AS.pdf and sending to local llama-qwen2vl-cli server...")
    with open(r"C:\Users\ASUS\Downloads\Ledger\AS.pdf", "rb") as f:
        content = f.read()

    rows = await parse_pdf(content)
    print("\n--- Extracted Transactions ---")
    for row in rows:
        print(row)

if __name__ == "__main__":
    asyncio.run(main())
