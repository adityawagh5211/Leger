import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { apiFetch, EXPENSE_CATEGORIES, setAuthToken, today } from "./lib";
import { useToast } from "./components/ui";
import Auth from "./views/Auth";
import Dashboard from "./views/Dashboard";
import Transactions from "./views/Transactions";
import Budgets from "./views/Budgets";
import Advisor from "./views/Advisor";
import Accounts from "./views/Accounts";
import ExportGST from "./views/ExportGST";
import AuditWebhooks from "./views/AuditWebhooks";
import Investments from "./views/Investments";
import CreditBenchmarks from "./views/CreditBenchmarks";
import CommandPalette from "./components/CommandPalette";
import {
  LayoutDashboard, Plus, Target, BarChart3, Sparkles,
  Wallet, Download, Shield, Command, Briefcase, Gauge, LogOut, Loader2, X
} from "lucide-react";

const VIEWS = [
  { id: "dashboard",    label: "Dashboard",       Icon: LayoutDashboard },
  { id: "transactions", label: "Transactions",    Icon: Plus },
  { id: "budgets",      label: "Budgets",         Icon: Target },
  { id: "analytics",    label: "Analytics",       Icon: BarChart3 },
  { id: "accounts",     label: "Accounts",        Icon: Wallet },
  { id: "investments",  label: "Investments",     Icon: Briefcase },
  { id: "credit",       label: "Health",          Icon: Gauge },
  { id: "export",       label: "Export",          Icon: Download },
  { id: "audit",        label: "Audit",           Icon: Shield },
  { id: "advisor",      label: "AI Advisor",      Icon: Sparkles },
];

export default function App() {
  const toast = useToast();
  const [view, setView] = useState("dashboard");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const touchStart = React.useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthToken(session?.access_token || null);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthToken(session?.access_token || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const renderView = () => {
    switch (view) {
      case "dashboard":    return <Dashboard />;
      case "transactions": return <Transactions />;
      case "budgets":      return <Budgets />;
      case "analytics":    return <Dashboard analyticsOnly />;
      case "accounts":     return <Accounts />;
      case "investments":  return <Investments />;
      case "credit":       return <CreditBenchmarks />;
      case "export":       return <ExportGST />;
      case "audit":        return <AuditWebhooks />;
      case "advisor":      return <Advisor />;
      default:             return <Dashboard />;
    }
  };

  function handleCmdClose(action) {
    if (action === "toggle") setCmdOpen(p => !p);
    else setCmdOpen(false);
  }

  function navigateBy(delta) {
    const index = VIEWS.findIndex((item) => item.id === view);
    const next = VIEWS[Math.max(0, Math.min(VIEWS.length - 1, index + delta))];
    if (next && next.id !== view) setView(next.id);
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" || sheetOpen) return;
    touchStart.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e) {
    if (!touchStart.current || e.pointerType === "mouse") return;
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      navigateBy(dx < 0 ? 1 : -1);
    }
  }

  if (loadingAuth) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin text-secondary" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="logo">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white"/>
                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white"/>
                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white"/>
                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white"/>
              </svg>
            </div>
            <div>
              <div className="logo-name">Ledger</div>
              <div className="logo-sub">AI Finance Platform</div>
            </div>
          </div>
          <nav className="nav-tabs" role="tablist">
            {VIEWS.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                className={`nav-tab${view === id ? " active" : ""}`}
                onClick={() => setView(id)}
                aria-selected={view === id}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            ))}
            <button
              className="nav-tab cmd-k-btn"
              onClick={() => setCmdOpen(true)}
              title="Command palette (Ctrl+K)"
              aria-label="Open command palette"
            >
              <Command size={14} />
              <kbd className="cmd-kbd-nav">⌘K</kbd>
            </button>
            <button
              className="nav-tab"
              onClick={handleSignOut}
              title="Sign Out"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </nav>
        </div>
      </header>
      <main
        className="page-content swipe-shell"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div key={view} className="swipe-view">{renderView()}</div>
      </main>
      <button className="quick-add-fab" onClick={() => setSheetOpen(true)} aria-label="Add transaction">
        <Plus size={22} />
      </button>
      <QuickAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => {
          toast("Transaction added", "success");
          if (view !== "transactions") setView("transactions");
        }}
      />
      <CommandPalette open={cmdOpen} onClose={handleCmdClose} onNavigate={setView} />
    </div>
  );
}

function QuickAddSheet({ open, onClose, onSaved }) {
  const toast = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    type: "expense",
    amount: "",
    category: "Groceries",
    description: "",
    date: today(),
    source: "cash",
  });

  async function save(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return toast("Enter a valid amount", "error");
    setSubmitting(true);
    try {
      await apiFetch("/transactions", {
        method: "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm({ type: "expense", amount: "", category: "Groceries", description: "", date: today(), source: "cash" });
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={`sheet-backdrop${open ? " open" : ""}`} onClick={onClose} />
      <section className={`bottom-sheet${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="form-section-title">Quick Transaction</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close quick transaction">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={save}>
          <div className="type-toggle">
            <button type="button" className={`type-btn${form.type === "expense" ? " active expense" : ""}`}
              onClick={() => setForm({ ...form, type: "expense", category: "Groceries" })}>
              Expense
            </button>
            <button type="button" className={`type-btn${form.type === "income" ? " active income" : ""}`}
              onClick={() => setForm({ ...form, type: "income", category: "Salary" })}>
              Income
            </button>
          </div>
          <div className="form-grid-2">
            <div className="form-field">
              <label className="form-label">Amount</label>
              <input required type="number" min="1" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Description</label>
            <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {(form.type === "income" ? ["Salary", "Freelance", "Other"] : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn-primary full-width" disabled={submitting}>
            {submitting ? "Adding..." : "Add Transaction"}
          </button>
        </form>
      </section>
    </>
  );
}
