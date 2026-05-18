import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { setAuthToken } from "./lib";
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
  Wallet, Download, Shield, Command, Briefcase, Gauge, LogOut, Loader2
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
  const [view, setView] = useState("dashboard");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

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
      <main className="page-content">{renderView()}</main>
      <CommandPalette open={cmdOpen} onClose={handleCmdClose} onNavigate={setView} />
    </div>
  );
}
