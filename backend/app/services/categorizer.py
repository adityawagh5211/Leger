import re


CATEGORIES = [
    "Housing",
    "Groceries",
    "Transport",
    "Dining",
    "Subscriptions",
    "Shopping",
    "Health",
    "Utilities",
    "Entertainment",
    "Other",
    "Salary",
    "Freelance",
]

EXPENSE_CATEGORIES = [c for c in CATEGORIES if c not in {"Salary", "Freelance"}]

RULES: list[tuple[str, str]] = [
    ("swiggy", "Dining"),
    ("zomato", "Dining"),
    ("restaurant", "Dining"),
    ("cafe", "Dining"),
    ("hotel", "Dining"),
    ("uber", "Transport"),
    ("ola", "Transport"),
    ("rapido", "Transport"),
    ("metro", "Transport"),
    ("petrol", "Transport"),
    ("amazon", "Shopping"),
    ("flipkart", "Shopping"),
    ("myntra", "Shopping"),
    ("dmart", "Groceries"),
    ("reliance fresh", "Groceries"),
    ("bigbasket", "Groceries"),
    ("netflix", "Subscriptions"),
    ("spotify", "Subscriptions"),
    ("hotstar", "Subscriptions"),
    ("prime video", "Subscriptions"),
    ("rent", "Housing"),
    ("electricity", "Utilities"),
    ("airtel", "Utilities"),
    ("jio", "Utilities"),
    ("bsnl", "Utilities"),
    ("broadband", "Utilities"),
    ("pharmacy", "Health"),
    ("medical", "Health"),
    ("hospital", "Health"),
    ("movie", "Entertainment"),
    ("bookmyshow", "Entertainment"),
    ("salary", "Salary"),
    ("payroll", "Salary"),
]

UPI_GENERIC_RE = re.compile(r"\b(upi|ybl|oksbi|okaxis|okhdfcbank|paytm|gpay|phonepe|bhim)\b", re.I)
UPI_MERCHANT_RE = re.compile(r"UPI/(?:DR|CR)/[^/]+/([^/]+)", re.I)


def extract_upi_merchant(description: str) -> str | None:
    match = UPI_MERCHANT_RE.search(description or "")
    if not match:
        return None
    merchant = re.sub(r"\s+", " ", match.group(1)).strip(" -/")
    return merchant or None


def is_generic_upi(description: str, category: str) -> bool:
    text = description or ""
    merchant = extract_upi_merchant(text)
    return category == "Other" and bool(UPI_GENERIC_RE.search(text) or merchant)


def categorize(description: str, tx_type: str = "expense") -> str:
    text = description.lower()
    for needle, category in RULES:
        if needle in text:
            return category
    return "Other" if tx_type == "expense" else "Salary"
