import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { apiFetch, EXPENSE_CATEGORIES, setAuthToken, today } from "./lib";
import { useToast, LegerLogo } from "./components/ui";
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
  Wallet, Download, Shield, Command, Briefcase, Gauge, LogOut, Loader2, X, MoreHorizontal, Grid
} from "lucide-react";

const PRIMARY_VIEWS = [
  { id: "dashboard",    label: "Dashboard",       Icon: LayoutDashboard },
  { id: "transactions", label: "Transactions",    Icon: Plus },
  { id: "budgets",      label: "Budgets",         Icon: Target },
  { id: "investments",  label: "Investments",     Icon: Briefcase },
  { id: "credit",       label: "Health",          Icon: Gauge },
  { id: "advisor",      label: "Amadeus AI",      Icon: Sparkles },
];

const SECONDARY_VIEWS = [
  { id: "accounts",     label: "Accounts",        Icon: Wallet },
  { id: "analytics",    label: "Analytics",       Icon: BarChart3 },
  { id: "export",       label: "Export & GST",    Icon: Download },
  { id: "audit",        label: "Audit Logs",      Icon: Shield },
];

const ALL_VIEWS = [...PRIMARY_VIEWS, ...SECONDARY_VIEWS];

function clearSupabaseStorage() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("sb-") || key.includes("supabase"))
    .forEach((key) => window.localStorage.removeItem(key));
}

export default function App() {
  const toast = useToast();
  const [view, setView] = useState("dashboard");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const touchStart = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMoreDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setAuthToken(session?.access_token || null);
      })
      .catch((error) => {
        console.warn("Supabase session restore failed", error);
        clearSupabaseStorage();
        setSession(null);
        setAuthToken(null);
      })
      .finally(() => setLoadingAuth(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESH_FAILED") {
        clearSupabaseStorage();
        setSession(null);
        setAuthToken(null);
        return;
      }
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
    const index = ALL_VIEWS.findIndex((item) => item.id === view);
    if (index === -1) return;
    const next = ALL_VIEWS[Math.max(0, Math.min(ALL_VIEWS.length - 1, index + delta))];
    if (next && next.id !== view) setView(next.id);
  }

  function handleTouchStart(e) {
    if (sheetOpen || moreDrawerOpen) return;
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(e) {
    if (!touchStart.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      navigateBy(dx < 0 ? 1 : -1);
    }
  }

  function navigateTo(id) {
    setView(id);
    setMoreDrawerOpen(false);
    setMoreDropdownOpen(false);
  }

  if (loadingAuth) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const isSecondaryActive = SECONDARY_VIEWS.some(v => v.id === view);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="logo">
            <LegerLogo size={38} />
            <div>
              <div className="logo-name">Ledger</div>
              <div className="logo-sub">AI Finance Platform</div>
            </div>
          </div>
          <nav className="nav-tabs" role="tablist">
            {PRIMARY_VIEWS.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                className={`nav-tab${view === id ? " active" : ""}`}
                onClick={() => navigateTo(id)}
                aria-selected={view === id}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
            
            {/* Desktop More Dropdown */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                className={`nav-tab${isSecondaryActive ? " active" : ""}`}
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
              >
                <MoreHorizontal size={16} /> More
              </button>
              {moreDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '8px',
                  boxShadow: 'var(--shadow-hover)', minWidth: '180px', zIndex: 200
                }}>
                  {SECONDARY_VIEWS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      className={`nav-tab full-width`}
                      style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                      onClick={() => navigateTo(id)}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />

            <button
              className="nav-tab cmd-k-btn"
              onClick={() => setCmdOpen(true)}
              title="Command palette (Ctrl+K)"
            >
              <Command size={14} />
              <kbd className="cmd-kbd">⌘K</kbd>
            </button>
            <button
              className="nav-tab"
              onClick={handleSignOut}
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </nav>
        </div>
      </header>
      
      <main
        className="page-content swipe-shell"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div key={view} className="swipe-view">{renderView()}</div>
      </main>

      <button className="quick-add-fab" onClick={() => setSheetOpen(true)} aria-label="Add transaction">
        <Plus size={24} />
      </button>

      {/* Mobile Bottom Nav (5 items with central Add) */}
      <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
        <button className={`mobile-nav-item${view === 'dashboard' ? " active" : ""}`} onClick={() => navigateTo('dashboard')}>
          <LayoutDashboard size={20} aria-hidden="true" />
          <span>Dashboard</span>
        </button>
        <button className={`mobile-nav-item${view === 'budgets' ? " active" : ""}`} onClick={() => navigateTo('budgets')}>
          <Target size={20} aria-hidden="true" />
          <span>Budgets</span>
        </button>
        
        <button className="mobile-nav-item center-add-btn" onClick={() => setSheetOpen(true)} aria-label="Add transaction">
          <div className="center-add-icon-wrap">
            <Plus size={24} aria-hidden="true" />
          </div>
          <span>Add</span>
        </button>

        <button className={`mobile-nav-item${view === 'investments' ? " active" : ""}`} onClick={() => navigateTo('investments')}>
          <Briefcase size={20} aria-hidden="true" />
          <span>Investments</span>
        </button>
        <button className={`mobile-nav-item${isSecondaryActive || view === "advisor" || view === "credit" || view === "transactions" ? " active" : ""}`} onClick={() => setMoreDrawerOpen(true)}>
          <Grid size={20} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Mobile More Drawer */}
      <div className={`sheet-backdrop${moreDrawerOpen ? " open" : ""}`} onClick={() => setMoreDrawerOpen(false)} />
      <div className={`bottom-sheet${moreDrawerOpen ? " open" : ""}`}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="form-section-title" style={{ marginBottom: 0 }}>All Features</div>
          <button className="icon-btn" onClick={() => setMoreDrawerOpen(false)}>
            <X size={18} />
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {ALL_VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`type-btn${view === id ? " active" : ""}`}
              style={{ justifyContent: 'flex-start', padding: '16px' }}
              onClick={() => navigateTo(id)}
            >
              <Icon size={18} className={view === id ? 'icon-accent' : ''} /> {label}
            </button>
          ))}
        </div>
        
        <button className="btn-secondary full-width" onClick={handleSignOut} style={{ color: 'var(--negative)', borderColor: '#fecdd3' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      <QuickAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => {
          toast("Transaction added", "success");
          if (view !== "transactions") setView("transactions");
        }}
      />
      <CommandPalette open={cmdOpen} onClose={handleCmdClose} onNavigate={navigateTo} />
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
          <div className="form-section-title" style={{ marginBottom: 0 }}>Add Transaction</div>
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
          
          <div className="form-field" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Amount</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
              <input required type="number" min="1" step="0.01" value={form.amount}
                placeholder="0.00"
                style={{ fontSize: 40, fontWeight: 700, textAlign: 'center', border: 'none', background: 'transparent', padding: 0, width: '200px', boxShadow: 'none' }}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div style={{ height: 2, background: 'var(--border)', width: 120, margin: '8px auto 0' }} />
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <label className="form-label">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {(form.type === "income" ? ["Salary", "Freelance", "Other"] : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          
          <div className="form-field" style={{ marginBottom: 32 }}>
            <label className="form-label">Description</label>
            <input required placeholder="What was this for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          
          <button className="btn-primary full-width" disabled={submitting} style={{ padding: '16px' }}>
            {submitting ? "Saving..." : "Save Transaction"}
          </button>
        </form>
      </section>
    </>
  );
}
