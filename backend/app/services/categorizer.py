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
    # ── Income / Salary ───────────────────────────────────────────────────────
    ("salary", "Salary"),
    ("payroll", "Salary"),
    # ── Utilities ─────────────────────────────────────────────────────────────
    ("electricity", "Utilities"),
    ("airtel", "Utilities"),
    ("jio", "Utilities"),
    ("bsnl", "Utilities"),
    ("broadband", "Utilities"),
    ("recharge", "Utilities"),
    ("rech", "Utilities"),
    ("vi p", "Utilities"),
    ("billpay", "Utilities"),
    ("utility", "Utilities"),
    ("utilities", "Utilities"),
    ("dth", "Utilities"),
    ("water bill", "Utilities"),
    ("gas bill", "Utilities"),
    ("ebzauranga", "Utilities"),
    # ── Subscriptions ─────────────────────────────────────────────────────────
    ("netflix", "Subscriptions"),
    ("spotify", "Subscriptions"),
    ("hotstar", "Subscriptions"),
    ("prime video", "Subscriptions"),
    ("coursera", "Subscriptions"),
    ("googleclou", "Subscriptions"),
    ("google cloud", "Subscriptions"),
    ("playstore", "Subscriptions"),
    ("dashreels", "Subscriptions"),
    ("github", "Subscriptions"),
    ("cursor", "Subscriptions"),
    ("youtube", "Subscriptions"),
    # ── Transport ─────────────────────────────────────────────────────────────
    ("uber", "Transport"),
    ("ola", "Transport"),
    ("rapido", "Transport"),
    ("metro", "Transport"),
    ("petrol", "Transport"),
    ("chalo", "Transport"),
    ("irctc", "Transport"),
    ("confirmtkt", "Transport"),
    ("confirm tkt", "Transport"),
    ("railway", "Transport"),
    ("flight", "Transport"),
    ("cab", "Transport"),
    ("auto", "Transport"),
    ("toll", "Transport"),
    ("fastag", "Transport"),
    ("bus", "Transport"),
    ("train", "Transport"),
    ("travel", "Transport"),
    ("indian r", "Transport"),
    # ── Health ────────────────────────────────────────────────────────────────
    ("pharmacy", "Health"),
    ("medical", "Health"),
    ("hospital", "Health"),
    ("clinic", "Health"),
    ("dental", "Health"),
    ("doctor", "Health"),
    ("medicine", "Health"),
    ("druggist", "Health"),
    ("chemist", "Health"),
    ("wellness", "Health"),
    ("healthcare", "Health"),
    # ── Dining ────────────────────────────────────────────────────────────────
    ("swiggy", "Dining"),
    ("zomato", "Dining"),
    ("restaurant", "Dining"),
    ("cafe", "Dining"),
    ("hotel", "Dining"),
    ("domino", "Dining"),
    ("dimono", "Dining"),
    ("pizza", "Dining"),
    ("mcdonald", "Dining"),
    ("mc donalds", "Dining"),
    ("kfc", "Dining"),
    ("burger king", "Dining"),
    ("burger k", "Dining"),
    ("subway", "Dining"),
    ("starbucks", "Dining"),
    ("dunkin", "Dining"),
    ("sf food", "Dining"),
    ("sana fat", "Dining"),  # SF FOOD's other UPI name
    ("shiraaz", "Dining"),
    ("koyla", "Dining"),
    ("aarambh", "Dining"),
    ("treat me", "Dining"),
    ("cool bev", "Dining"),
    ("orange j", "Dining"),
    ("roll n r", "Dining"),
    ("raps bir", "Dining"),
    ("bakery", "Dining"),
    ("sweets", "Dining"),
    ("dhaba", "Dining"),
    ("kitchen", "Dining"),
    ("caterers", "Dining"),
    ("kabab", "Dining"),
    ("eats", "Dining"),
    ("bites", "Dining"),
    ("food", "Dining"),
    ("lucky juice", "Dining"),
    ("dosa plaza", "Dining"),
    ("bholes r", "Dining"),
    ("bholes restaurant", "Dining"),
    ("tirupati", "Dining"),
    ("gaavaran", "Dining"),
    ("saikripa", "Dining"),
    ("maa durg", "Dining"),
    ("shree sa", "Dining"),
    ("shri swa", "Dining"),
    ("kalyani", "Dining"),
    ("jijau me", "Dining"),
    ("suprassa", "Dining"),
    ("mess", "Dining"),
    ("canteen", "Dining"),
    ("cateen", "Dining"),
    ("mgm spor", "Dining"),  # MGM sports canteen
    ("gajanan", "Dining"),  # Gajanan canteen (same as MGM)
    # ── Groceries ─────────────────────────────────────────────────────────────
    ("blinkit", "Groceries"),
    ("zepto", "Groceries"),
    ("instamart", "Groceries"),
    ("dunzo", "Groceries"),
    ("dmart", "Groceries"),
    ("reliance fresh", "Groceries"),
    ("bigbasket", "Groceries"),
    ("milk", "Groceries"),
    ("dairy", "Groceries"),
    ("groceries", "Groceries"),
    ("grocery", "Groceries"),
    ("supermarket", "Groceries"),
    ("mart", "Groceries"),
    ("neel kir", "Groceries"),
    ("tarte ki", "Groceries"),
    ("shree ga", "Groceries"),
    ("kirana", "Groceries"),
    # ── Entertainment ─────────────────────────────────────────────────────────
    ("movie", "Entertainment"),
    ("bookmyshow", "Entertainment"),
    ("district", "Entertainment"),  # District app for shows
    ("sports", "Entertainment"),
    ("cinema", "Entertainment"),
    ("theater", "Entertainment"),
    ("insider", "Entertainment"),
    # ── Housing ───────────────────────────────────────────────────────────────
    ("rent", "Housing"),
    # ── Shopping ──────────────────────────────────────────────────────────────
    ("amazon", "Shopping"),
    ("flipkart", "Shopping"),
    ("myntra", "Shopping"),
    ("croma", "Shopping"),
    ("mr diy", "Shopping"),
    ("ekart", "Shopping"),
    ("shopping", "Shopping"),
    ("clothing", "Shopping"),
    ("dress", "Shopping"),
    ("mall", "Shopping"),
    ("fashion", "Shopping"),
    ("boutique", "Shopping"),
    ("retail", "Shopping"),
    ("footwear", "Shopping"),
    ("shoes", "Shopping"),
    ("prozone", "Shopping"),
    ("samsung", "Shopping"),
    ("saketboo", "Shopping"),
    ("appaji k", "Shopping"),
    ("amazonpayr", "Shopping"),
    ("a mazonpayr", "Shopping"),
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
    text = (description or "").lower()

    # 1. Standard substring match
    for needle, category in RULES:
        if needle in text:
            return category

    # 2. Spaceless substring match (for needles length >= 5)
    spaceless_text = text.replace(" ", "")
    for needle, category in RULES:
        needle_spaceless = needle.replace(" ", "")
        if len(needle_spaceless) >= 5 and needle_spaceless in spaceless_text:
            return category

    return "Other" if tx_type == "expense" else "Salary"
