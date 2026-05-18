import sys
sys.path.insert(0, ".")

with open(r"C:\Users\ASUS\Downloads\Ledger\AS.pdf", "rb") as f:
    content = f.read()

print("Testing PaddleOCR on AS.pdf...")
from app.services.statements import parse_pdf
rows = parse_pdf(content)

print(f"\n{'='*50}")
print(f"Total transactions parsed: {len(rows)}")
print(f"{'='*50}")
for r in rows[:10]:
    print(r)
