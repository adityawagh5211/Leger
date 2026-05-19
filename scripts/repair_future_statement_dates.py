"""
Repair statement transactions whose day/month was imported as month/day.

Dry run:
  python scripts/repair_future_statement_dates.py

Apply:
  python scripts/repair_future_statement_dates.py --apply
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal  # noqa: E402
from app.models import Transaction  # noqa: E402


def swapped_date(value: date) -> date | None:
    if value.day > 12:
        return None
    try:
        candidate = date(value.year, value.day, value.month)
    except ValueError:
        return None
    return candidate if candidate <= date.today() else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Persist repairs")
    parser.add_argument("--user-id", help="Only repair one user")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        q = db.query(Transaction).filter(
            Transaction.source == "statement",
            Transaction.date > date.today(),
        )
        if args.user_id:
            q = q.filter(Transaction.user_id == args.user_id)

        repairs = []
        for tx in q.order_by(Transaction.date.desc()).all():
            candidate = swapped_date(tx.date)
            if candidate:
                repairs.append((tx, candidate))

        for tx, candidate in repairs:
            print(f"{tx.id} user={tx.user_id} {tx.date} -> {candidate} INR {tx.amount} {tx.description[:80]}")
            if args.apply:
                tx.date = candidate

        if args.apply:
            db.commit()
            print(f"Updated {len(repairs)} transactions.")
        else:
            print(f"Would update {len(repairs)} transactions. Re-run with --apply to persist.")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
