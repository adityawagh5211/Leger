#!/usr/bin/env python
"""
migrate_dev_db.py
-----------------
Safe, idempotent migration helper for the development SQLite database.
Run this whenever the SQLAlchemy models gain new columns that the existing
ledger_dev.db does not yet have.

Usage (from backend/ dir):
    python ../scripts/migrate_dev_db.py [--db path/to/ledger_dev.db]
"""
import argparse
import sqlite3
from pathlib import Path

# ---------------------------------------------------------------------------
# Column definitions: (table, column_name, sql_type, nullable_default)
# Add new entries here whenever models.py gains a column.
# ---------------------------------------------------------------------------
COLUMNS: list[tuple[str, str, str, str | None]] = [
    # transactions
    ("transactions", "account_id",           "VARCHAR(36)",    None),
    ("transactions", "merchant_normalized",   "VARCHAR(128)",   None),
    ("transactions", "confidence",            "FLOAT",          None),
    ("transactions", "tags",                  "VARCHAR(512)",   None),
    ("transactions", "notes",                 "TEXT",           None),
    ("transactions", "gst_rate",              "FLOAT",          None),
    ("transactions", "gst_amount",            "NUMERIC(10,2)",  None),
    ("transactions", "hsn_code",              "VARCHAR(16)",    None),
]


def migrate(db_path: Path) -> None:
    if not db_path.exists():
        print(f"[skip] Database not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    try:
        for table, col, col_type, default in COLUMNS:
            cursor = conn.cursor()
            cursor.execute(f"PRAGMA table_info({table})")
            existing = {row[1] for row in cursor.fetchall()}

            if col in existing:
                print(f"[ok]   {table}.{col} already exists")
                continue

            sql = f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"
            if default is not None:
                sql += f" DEFAULT {default}"
            print(f"[add]  {sql}")
            conn.execute(sql)

        conn.commit()
        print("\nMigration complete.")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate dev SQLite DB")
    parser.add_argument(
        "--db",
        default=str(Path(__file__).parent.parent / "backend" / "ledger_dev.db"),
        help="Path to ledger_dev.db",
    )
    args = parser.parse_args()
    migrate(Path(args.db))
