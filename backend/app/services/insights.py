from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from ..models import Budget, Transaction
from .categorizer import EXPENSE_CATEGORIES

SYSTEM_PROMPT = (
    "You are a concise finance assistant for Indian users. Answer in 3 sentences or fewer. "
    "Use only the provided financial snapshot and recent transaction rows. "
    "Do not claim you lack transaction access when recent transactions are present in context."
)


def monthly_summary(transactions: list[Transaction]) -> dict:
    income = sum((t.amount for t in transactions if t.type == "income"), Decimal("0"))
    expenses = sum((t.amount for t in transactions if t.type == "expense"), Decimal("0"))
    by_category: dict[str, Decimal] = defaultdict(Decimal)
    by_day: dict[str, dict] = defaultdict(lambda: {"income": Decimal("0"), "expenses": Decimal("0")})
    by_month: dict[str, dict] = defaultdict(lambda: {"income": Decimal("0"), "expenses": Decimal("0")})
    dates = [tx.date for tx in transactions]

    # Cash-only breakdown (source='cash' = manually entered, not from bank statement)
    cash_income = sum((t.amount for t in transactions if t.type == "income" and t.source == "cash"), Decimal("0"))
    cash_expenses = sum((t.amount for t in transactions if t.type == "expense" and t.source == "cash"), Decimal("0"))

    for tx in transactions:
        day = str(tx.date)
        month = tx.date.strftime("%Y-%m")
        if tx.type == "expense":
            by_category[tx.category] += tx.amount
            by_day[day]["expenses"] += tx.amount
            by_month[month]["expenses"] += tx.amount
        else:
            by_day[day]["income"] += tx.amount
            by_month[month]["income"] += tx.amount

    start_date = min(dates).isoformat() if dates else None
    end_date = max(dates).isoformat() if dates else None

    return {
        "income": income,
        "expenses": expenses,
        "net": income - expenses,
        "opening_balance": None,  # computed by caller via DB query
        "closing_balance": None,  # computed by caller via DB query
        "cash_income": cash_income,
        "cash_expenses": cash_expenses,
        "cash_net": cash_income - cash_expenses,
        "by_category": dict(by_category),
        "by_day": dict(by_day),
        "by_month": dict(by_month),
        "period_start": start_date,
        "period_end": end_date,
        "months_covered": len({d.strftime("%Y-%m") for d in dates}),
    }


def dynamic_budget_suggestions(transactions: list[Transaction]) -> list[dict]:
    """Suggest budgets based on observed monthly spending average at 90% cap."""
    totals: dict[str, Decimal] = defaultdict(Decimal)
    months = {tx.date.strftime("%Y-%m") for tx in transactions}
    divisor = Decimal(max(len(months), 1))
    for tx in transactions:
        totals[tx.category] += tx.amount
    return [
        {
            "category": cat,
            "monthly_limit": round((totals[cat] / divisor) * Decimal("0.9"), 2),
            "strategy": f"dynamic_{len(months) or 1}mo_90",
        }
        for cat in EXPENSE_CATEGORIES
        if totals[cat] > 0
    ]


def compute_insights(transactions: list[Transaction], budgets: list[Budget]) -> list[str]:
    summary = monthly_summary(transactions)
    insights: list[str] = []
    budget_map = {b.category: b.monthly_limit for b in budgets}

    for category, spent in summary["by_category"].items():
        budget = budget_map.get(category)
        if not budget:
            continue
        ratio = spent / budget if budget else Decimal("0")
        if ratio >= Decimal("1"):
            insights.append(f"{category} is over budget: spent INR {spent} vs INR {budget} limit.")
        elif ratio >= Decimal("0.8"):
            insights.append(f"{category} at {int(ratio * 100)}% of budget: INR {spent} of INR {budget}.")

    recent = [t for t in transactions if t.type == "expense" and t.date >= date.today() - timedelta(days=7)]
    merchant_totals: dict[str, Decimal] = defaultdict(Decimal)
    for tx in recent:
        merchant_totals[tx.description] += tx.amount
    if merchant_totals:
        merchant, amount = max(merchant_totals.items(), key=lambda x: x[1])
        insights.append(f"Top weekly merchant: {merchant} at INR {amount}.")

    return insights


def recurring_payments(transactions: list[Transaction]) -> list[dict]:
    grouped: dict[tuple, list] = defaultdict(list)
    for tx in transactions:
        if tx.type == "expense":
            grouped[(tx.description.lower(), tx.category)].append(tx)
    recurring = []
    for (description, category), items in grouped.items():
        if len(items) >= 2:
            amounts = [item.amount for item in items]
            avg = sum(amounts, Decimal("0")) / len(amounts)
            recurring.append(
                {
                    "description": description.title(),
                    "category": category,
                    "average_amount": avg,
                    "count": len(items),
                }
            )
    return sorted(recurring, key=lambda x: x["average_amount"], reverse=True)


def build_advisor_context(
    transactions: list[Transaction],
    budgets: list[Budget],
) -> str:
    """Build a compact, token-efficient financial context string."""
    summary = monthly_summary(transactions)
    budget_map = {b.category: b.monthly_limit for b in budgets}
    recurring = recurring_payments(transactions)

    budget_lines = []
    for cat, spent in sorted(summary["by_category"].items(), key=lambda x: x[1], reverse=True)[:8]:
        limit = budget_map.get(cat)
        if limit:
            pct = int((spent / limit) * 100)
            budget_lines.append(f"  {cat}: INR {spent} / INR {limit} ({pct}%)")
        else:
            budget_lines.append(f"  {cat}: INR {spent} (no budget set)")

    recurring_lines = [
        f"  {r['description']}: ~INR {r['average_amount']:.0f}/mo ({r['count']}x)" for r in recurring[:4]
    ]
    latest = sorted(transactions, key=lambda tx: (tx.date, tx.created_at), reverse=True)[:12]
    latest_lines = [
        f"  {tx.date.isoformat()} | {tx.type} | INR {tx.amount} | {tx.category} | {tx.description[:160]}"
        for tx in latest
    ]
    period = (
        f"{summary['period_start']} to {summary['period_end']}"
        if summary["period_start"] and summary["period_end"]
        else "No transaction period"
    )
    month_lines = [
        f"  {month}: income INR {row['income']} | expenses INR {row['expenses']}"
        for month, row in sorted(summary["by_month"].items())
    ]

    today_str = date.today().isoformat()
    last_month = (date.today().replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    last_month_stats = summary["by_month"].get(last_month, {"income": Decimal("0"), "expenses": Decimal("0")})

    # Format balance lines if available from bank statement data
    opening_bal = summary.get("opening_balance")
    closing_bal = summary.get("closing_balance")
    balance_line = ""
    if closing_bal is not None:
        balance_line = f"  Opening Balance: INR {opening_bal if opening_bal is not None else 'N/A'} | Closing Balance: INR {closing_bal}"
    else:
        balance_line = f"  Net Cash Flow: INR {summary['net']} (no bank balance data — transactions may be manual/SMS)"

    context = f"""[Financial Snapshot - {period}]
Current Date: {today_str}
Period covered: {period} across {summary["months_covered"]} calendar month(s).

Last Month ({last_month}) Summary:
  Income: INR {last_month_stats["income"]} | Expenses: INR {last_month_stats["expenses"]}

Overall Snapshot:
  Income (Credits): INR {summary["income"]} | Expenses (Debits): INR {summary["expenses"]} | Net Flow: INR {summary["net"]}
Balance:
{balance_line}

Top Spending by Category:
{chr(10).join(budget_lines) or "  No expense data yet."}

Monthly Breakdown:
{chr(10).join(month_lines) or "  No monthly data yet."}

Latest Transactions:
{chr(10).join(latest_lines) or "  No transactions found for this signed-in account."}

Detected Recurring Payments:
{chr(10).join(recurring_lines) or "  None detected."}

Total transactions analyzed: {len(transactions)}"""

    return context
