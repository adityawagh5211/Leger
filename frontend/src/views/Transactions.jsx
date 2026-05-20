import React from "react";
import { apiFetch, KEYS, money, today, EXPENSE_CATEGORIES, CATEGORY_COLORS } from "../lib";
import { useToast } from "../components/ui";
import { Trash2, Upload, Search, FileText, MessageSquare, PlusCircle, CheckSquare } from "lucide-react";

const PAGE = 50;
// Delay (ms) before the bulk-delete API call fires, giving time to Undo
const UNDO_DELAY = 5000;

export default function Transactions() {
  const toast = useToast();
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading]           = React.useState(true);
  const [submitting, setSubmitting]     = React.useState(false);
  const [importing, setImporting]       = React.useState(false);
  const [nextCursor, setNextCursor]     = React.useState(null);
  const [hasMore, setHasMore]           = React.useState(false);
  const [search, setSearch]             = React.useState("");
  const [filterCat, setFilterCat]       = React.useState("");
  const [filterType, setFilterType]     = React.useState("");
  const [smsText, setSmsText]           = React.useState("");
  const [importStatus, setImportStatus] = React.useState(null);
  const [activeTab, setActiveTab]       = React.useState("manual");

  // Multi-select state
  const [selectedIds, setSelectedIds]   = React.useState(new Set());
  // IDs of rows currently animating out
  const [deletingIds, setDeletingIds]   = React.useState(new Set());
  // Undo state: { ids, snapshot, timer, countdown }
  const [undoState, setUndoState]       = React.useState(null);
  const undoCountRef                    = React.useRef(null);

  const [form, setForm] = React.useState({
    type: "expense", amount: "", category: "Groceries",
    description: "", date: today(), source: "cash",
  });

  // ── Data Loading ────────────────────────────────────────────────────────────
  const loadTransactions = React.useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE });
      if (search)     params.set("search", search);
      if (filterCat)  params.set("category", filterCat);
      if (filterType) params.set("type", filterType);
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const data = await apiFetch(`/transactions?${params}`);
      setTransactions((prev) => reset ? data.items : [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [search, filterCat, filterType, nextCursor]);

  React.useEffect(() => { loadTransactions(true); }, [search, filterCat, filterType]);

  // ── Single delete (immediate, optimistic) ───────────────────────────────────
  async function remove(id) {
    // Animate row out first
    setDeletingIds((s) => new Set([...s, id]));
    await new Promise((r) => setTimeout(r, 280));
    const prev = [...transactions];
    setTransactions((t) => t.filter((x) => x.id !== id));
    setDeletingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    try {
      await apiFetch(`/transactions/${id}`, { method: "DELETE" });
      toast("Transaction deleted", "success");
    } catch (e) {
      setTransactions(prev);
      toast(e.message, "error");
    }
  }

  // ── Selection helpers ───────────────────────────────────────────────────────
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Bulk delete with undo timer ─────────────────────────────────────────────
  function requestBulkDelete() {
    if (selectedIds.size === 0) return;

    const ids = [...selectedIds];
    const snapshot = [...transactions];

    // Animate out
    setDeletingIds(new Set(ids));

    // Commit to UI immediately (optimistic)
    setTimeout(() => {
      setTransactions((t) => t.filter((x) => !ids.includes(x.id)));
      setDeletingIds(new Set());
    }, 300);

    setSelectedIds(new Set());

    // Start undo countdown
    let remaining = Math.ceil(UNDO_DELAY / 1000);
    const undoTimer = setTimeout(() => executeBulkDelete(ids), UNDO_DELAY);
    clearInterval(undoCountRef.current);
    undoCountRef.current = setInterval(() => {
      remaining -= 1;
      setUndoState((prev) => prev ? { ...prev, countdown: remaining } : null);
      if (remaining <= 0) clearInterval(undoCountRef.current);
    }, 1000);

    setUndoState({ ids, snapshot, timer: undoTimer, countdown: remaining });
  }

  async function executeBulkDelete(ids) {
    clearInterval(undoCountRef.current);
    setUndoState(null);
    try {
      await apiFetch("/transactions/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ transaction_ids: ids }),
      });
      toast(`${ids.length} transaction${ids.length > 1 ? "s" : ""} deleted`, "success");
    } catch (e) {
      toast(e.message, "error");
      // Reload to restore true state from DB
      await loadTransactions(true);
    }
  }

  function undoBulkDelete() {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    clearInterval(undoCountRef.current);
    setTransactions(undoState.snapshot);
    setUndoState(null);
    toast("Deletion undone ✓", "success");
  }

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (undoState?.timer) clearTimeout(undoState.timer);
      clearInterval(undoCountRef.current);
    };
  }, [undoState]);

  // ── Add transaction ─────────────────────────────────────────────────────────
  async function addTransaction(e) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) return toast("Enter a valid amount", "error");
    setSubmitting(true);
    try {
      await apiFetch("/transactions", {
        method: "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm({ type: "expense", amount: "", category: "Groceries", description: "", date: today(), source: "cash" });
      await loadTransactions(true);
      toast("Transaction added", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── SMS import ──────────────────────────────────────────────────────────────
  async function importSms() {
    const messages = smsText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (!messages.length) return;
    setImporting(true);
    try {
      const saved = await apiFetch("/imports/sms", {
        method: "POST",
        body: JSON.stringify({ messages }),
      });
      setSmsText("");
      await loadTransactions(true);
      toast(`Imported ${saved.length} transactions from SMS`, "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setImporting(false);
    }
  }

  // ── Statement upload ────────────────────────────────────────────────────────
  async function uploadStatement(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    e.target.value = "";
    try {
      const job = await apiFetch("/imports/statement", { method: "POST", body });
      setImportStatus("processing");
      toast("Statement uploaded — processing…", "info");
      const poll = setInterval(async () => {
        try {
          const j = await apiFetch(`/imports/jobs/${job.id}`);
          setImportStatus(j.status);
          if (j.status === "done") {
            clearInterval(poll);
            toast(`Import complete — ${j.row_count} transactions added`, "success");
            await loadTransactions(true);
          } else if (j.status === "failed") {
            clearInterval(poll);
            toast(`Import failed: ${j.error_message}`, "error");
          }
        } catch { clearInterval(poll); }
      }, 1500);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  const TABS = [
    { id: "manual",    label: "Add Manually",   Icon: PlusCircle },
    { id: "sms",       label: "SMS Import",     Icon: MessageSquare },
    { id: "statement", label: "Bank Statement", Icon: FileText },
  ];

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="view-transactions">
      <div>
        <h1 className="page-title">Transactions</h1>
        <p className="page-subtitle">Log, import and manage every transaction</p>
      </div>

      {/* Tabbed add/import card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="import-tab-bar">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`import-tab-btn${activeTab === id ? " active" : ""}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Manual form */}
        {activeTab === "manual" && (
          <form onSubmit={addTransaction}>
            <div className="type-toggle">
              <button type="button"
                className={`type-btn${form.type === "expense" ? " active expense" : ""}`}
                onClick={() => setForm({ ...form, type: "expense", category: "Groceries" })}>
                Expense
              </button>
              <button type="button"
                className={`type-btn${form.type === "income" ? " active income" : ""}`}
                onClick={() => setForm({ ...form, type: "income", category: "Salary" })}>
                Income
              </button>
            </div>
            <div className="form-grid-2">
              <div className="form-field">
                <label className="form-label">Amount</label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix">₹</span>
                  <input required type="number" min="1" step="0.01" placeholder="0.00"
                    value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Date</label>
                <input type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Description</label>
              <input placeholder="What was this for?" value={form.description} required
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 28 }}>
              <label className="form-label">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {(form.type === "income" ? ["Salary", "Freelance", "Other"] : EXPENSE_CATEGORIES)
                  .map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '13px 28px' }} disabled={submitting}>
              {submitting ? "Adding…" : "Add Transaction"}
            </button>
          </form>
        )}

        {/* SMS import */}
        {activeTab === "sms" && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              Paste UPI / bank SMS messages (one per line). Amadeus AI will extract transactions automatically.
            </p>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="form-label">SMS Messages</label>
              <textarea rows={6} placeholder="Paste SMS messages here, one per line…"
                value={smsText} onChange={(e) => setSmsText(e.target.value)}
                style={{ resize: 'vertical' }} />
            </div>
            <button className="btn-primary" onClick={importSms}
              disabled={importing || !smsText.trim()}>
              <Upload size={16} /> {importing ? "Parsing…" : "Parse & Import SMS"}
            </button>
          </div>
        )}

        {/* Statement upload */}
        {activeTab === "statement" && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              Upload your bank statement in CSV, Excel, or PDF format. We'll automatically extract and categorize your transactions.
            </p>
            <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '40px 24px', textAlign: 'center', marginBottom: 16, background: 'var(--bg)', transition: 'border-color 0.2s' }}>
              <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Drop your file here</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Supports CSV, XLS, XLSX, PDF</div>
              <label className="btn-secondary" style={{ cursor: 'pointer', padding: '10px 24px' }}>
                Browse File
                <input type="file" accept=".csv,.xls,.xlsx,.pdf" onChange={uploadStatement} style={{ display: 'none' }} />
              </label>
            </div>
            {importStatus && (
              <div style={{
                padding: '14px 18px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                background: importStatus === 'done' ? '#ecfdf5' : importStatus === 'failed' ? '#fff1f2' : '#eff6ff',
                color: importStatus === 'done' ? '#059669' : importStatus === 'failed' ? '#e11d48' : '#4f46e5',
                border: `1px solid ${importStatus === 'done' ? '#a7f3d0' : importStatus === 'failed' ? '#fecdd3' : '#c7d2fe'}`,
              }}>
                {importStatus === "processing" && "⏳ Processing your statement…"}
                {importStatus === "done"       && "✅ Import complete!"}
                {importStatus === "failed"     && "❌ Import failed. Please try again."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="card">
        {/* List header with search/filter */}
        <div className="tx-list-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="chart-title">Recent Transactions</div>
            {selectedIds.size > 0 && (
              <span style={{
                background: 'var(--accent)', color: 'white',
                fontSize: 12, fontWeight: 700, padding: '2px 10px',
                borderRadius: 99, lineHeight: 1.8,
              }}>
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="tx-filters">
            <div className="search-wrap" style={{ maxWidth: 280 }}>
              <Search size={15} className="search-icon" />
              <input className="search-input" placeholder="Search…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="filter-select" value={filterType}
              onChange={(e) => setFilterType(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
        </div>

        {/* Desktop column headers */}
        <div className="tx-head">
          <div className="tx-checkbox-wrap">
            <input
              type="checkbox"
              className="tx-checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleSelectAll}
              aria-label="Select all transactions"
              title={allSelected ? "Deselect all" : "Select all"}
            />
          </div>
          <span>Date</span>
          <span>Category</span>
          <span>Description</span>
          <span>Amount</span>
          <span />
        </div>

        {/* Skeleton loading rows */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="tx-item">
            <div />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="skeleton" style={{ height: 14, borderRadius: 6 }} />
            ))}
            <div />
          </div>
        ))}

        {/* Empty state */}
        {!loading && transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No transactions found</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Add one above or adjust your filters</div>
          </div>
        )}

        {/* Transaction rows */}
        {!loading && transactions.map((tx) => {
          const isSelected = selectedIds.has(tx.id);
          const isDeleting = deletingIds.has(tx.id);
          return (
            <div
              key={tx.id}
              className={`tx-item${isSelected ? " selected" : ""}${isDeleting ? " tx-deleting" : ""}`}
              onClick={(e) => {
                // Don't trigger selection on button clicks
                if (e.target.closest("button") || e.target.closest(".tx-checkbox")) return;
                toggleSelect(tx.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Checkbox */}
              <div className="tx-checkbox-wrap" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="tx-checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(tx.id)}
                  aria-label={`Select ${tx.description}`}
                />
              </div>

              <span className="tx-date" style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
                {tx.date}
              </span>

              <span className="tx-cat-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[tx.category] || '#94a3b8', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{tx.category}</span>
              </span>

              <span className="tx-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.description}
              </span>

              <span className={tx.type === "income" ? "tx-amount-income" : "tx-amount-expense"}>
                {tx.type === "income" ? "+" : "−"}{money(tx.amount)}
              </span>

              <button
                className="tx-delete-btn"
                onClick={(e) => { e.stopPropagation(); remove(tx.id); }}
                aria-label={`Delete ${tx.description}`}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        {/* Load more */}
        {hasMore && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-secondary" onClick={() => loadTransactions(false)} style={{ fontSize: 14 }}>
              Load more
            </button>
          </div>
        )}
      </div>

      {/* Floating bulk action bar — shown when rows are selected */}
      {selectedIds.size > 0 && !undoState && (
        <div className="floating-action-bar">
          <CheckSquare size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>{selectedIds.size} transaction{selectedIds.size > 1 ? "s" : ""} selected</span>
          <button className="btn-clear-selection" onClick={clearSelection}>
            Clear
          </button>
          <button className="btn-delete-bulk" onClick={requestBulkDelete}>
            <Trash2 size={14} />
            Delete {selectedIds.size > 1 ? `${selectedIds.size} transactions` : "transaction"}
          </button>
        </div>
      )}

      {/* Floating undo bar — shown during the undo countdown */}
      {undoState && (
        <div className="floating-undo-bar">
          <span style={{ color: 'var(--text-secondary)' }}>
            🗑️ Deleting {undoState.ids.length} transaction{undoState.ids.length > 1 ? "s" : ""}…
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: undoState.countdown <= 2 ? 'var(--negative)' : 'var(--text-muted)',
            minWidth: 20, textAlign: 'center',
          }}>
            {undoState.countdown}s
          </span>
          <button className="btn-undo" onClick={undoBulkDelete}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
