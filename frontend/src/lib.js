// ── API Base & helpers ────────────────────────────────────────────────────────
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
let currentToken = import.meta.env.VITE_DEV_AUTH_TOKEN || "dev-user";

export function setAuthToken(token) {
  currentToken = token;
}

function getToken() {
  return currentToken;
}

export function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  };
}

export async function apiFetch(path, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...authHeaders(),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream")) return res;
  return res.json();
}

// ── Query keys ───────────────────────────────────────────────────────────────
export const KEYS = {
  transactions:  (params) => ["transactions", params],
  budgets:       ()       => ["budgets"],
  summary:       (month)  => ["summary", month],
  conversations: ()       => ["conversations"],
  messages:      (id)     => ["messages", id],
  importJob:     (id)     => ["importJob", id],
};

// ── Constants shared across components (expanded to 18 categories) ────────────
export const CATEGORIES = [
  "Housing", "Groceries", "Transport", "Dining", "Subscriptions",
  "Shopping", "Health", "Utilities", "Entertainment",
  "Education", "Insurance", "Investments", "Transfers", "Taxes", "Fees",
  "Other", "Salary", "Freelance",
];

export const EXPENSE_CATEGORIES = [
  "Housing", "Groceries", "Transport", "Dining", "Subscriptions",
  "Shopping", "Health", "Utilities", "Entertainment",
  "Education", "Insurance", "Investments", "Transfers", "Taxes", "Fees",
  "Other",
];

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Other"];

export const CATEGORY_COLORS = {
  Housing:       "#A8FF2F",
  Groceries:     "#38BDF8",
  Transport:     "#FACC15",
  Dining:        "#FF3B3B",
  Subscriptions: "#A8FF2F",
  Shopping:      "#38BDF8",
  Health:        "#FF3B3B",
  Utilities:     "#94A3B8",
  Entertainment: "#FACC15",
  Education:     "#38BDF8",
  Insurance:     "#A8FF2F",
  Investments:   "#A8FF2F",
  Transfers:     "#64748B",
  Taxes:         "#FF3B3B",
  Fees:          "#FF3B3B",
  Other:         "#64748B",
  Salary:        "#A8FF2F",
  Freelance:     "#A8FF2F",
};

export const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(v || 0));

export const today = () => new Date().toISOString().slice(0, 10);
