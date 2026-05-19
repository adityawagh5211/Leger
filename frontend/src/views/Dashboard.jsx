import React from "react";
import { apiFetch, money, CATEGORY_COLORS } from "../lib";
import { CardSkeleton } from "../components/ui";
import { useToast } from "../components/ui";
import ProactiveInsights from "../components/ProactiveInsights";
import {
  TrendingUp, TrendingDown, DollarSign, PiggyBank, Calendar, AlertCircle, BarChart3, Target, Banknote,
} from "lucide-react";
import {
  BarChart, Bar, Area, AreaChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const TIME_FILTERS = [
  { id: "this_month", label: "This Month" },
  { id: "3m",         label: "3 Months" },
  { id: "current_year", label: "This Year" },
  { id: "all",        label: "All Time" },
];

export default function Dashboard({ analyticsOnly = false }) {
  const toast = useToast();
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState("this_month");

  React.useEffect(() => {
    setLoading(true);
    apiFetch(`/summary?range=${timeRange}`)
      .then(setSummary)
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [timeRange]);

  if (loading) {
    return (
      <div className="view-dashboard">
        <div className="page-title-block">
          <h1 className="page-title">{analyticsOnly ? "Analytics" : "Dashboard"}</h1>
          <p className="page-subtitle">Loading your financial data…</p>
        </div>
        <div className="account-grid">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="charts-grid">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const income   = Number(summary?.income   || 0);
  const expenses = Number(summary?.expenses || 0);
  const net      = Number(summary?.net      || 0);
  const saved    = Math.max(0, income - expenses);
  const savingsRate = income > 0 ? Math.round((saved / income) * 100) : 0;
  const periodLabel = summary?.period_start && summary?.period_end
    ? `${summary.period_start} → ${summary.period_end}`
    : "All available transactions";

  const closingBalance = summary?.closing_balance != null ? Number(summary.closing_balance) : null;
  const openingBalance = summary?.opening_balance != null ? Number(summary.opening_balance) : null;
  const hasBalanceData = closingBalance !== null;

  const byCategory = summary?.by_category || {};
  const pieRows = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const topCat = pieRows[0]?.name || "—";

  const dayRows = Object.entries(summary?.by_day || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([d, row]) => ({
      date: d.slice(5),
      Income: Number(row.income),
      Expenses: Number(row.expenses),
    }));
  const monthRows = Object.entries(summary?.by_month || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      Income: Number(row.income),
      Expenses: Number(row.expenses),
    }));

  const cashIncome   = Number(summary?.cash_income   || 0);
  const cashExpenses = Number(summary?.cash_expenses || 0);
  const cashNet      = Number(summary?.cash_net      || 0);
  const hasCash = cashIncome > 0 || cashExpenses > 0;

  const kpiCards = [
    { label: "Total Income",   val: income,   change: `${periodLabel}`,  type: "positive", Icon: TrendingUp },
    { label: "Total Expenses", val: expenses, change: `${periodLabel}`,  type: "negative", Icon: TrendingDown },
    { label: "Net Savings",    val: saved,    change: income > 0 ? `${savingsRate}% savings rate` : "—", type: "positive", Icon: PiggyBank },
    { label: "Recurring",      val: summary?.recurring?.length || 0, change: "Payments detected", type: "muted", Icon: Calendar, isCount: true },
    ...(hasCash ? [{ label: "Cash Net", val: cashNet, change: "Physical cash", type: cashNet >= 0 ? "positive" : "negative", Icon: Banknote, isCash: true }] : []),
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
          {payload.map(p => (
            <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: p.color, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
              {p.dataKey}: {money(p.value)}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const kpiColors = { positive: '#10b981', negative: '#f43f5e', muted: '#94a3b8' };
  const kpiBgColors = { positive: '#ecfdf5', negative: '#fff1f2', muted: '#f8fafc' };

  return (
    <div className="view-dashboard">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>{analyticsOnly ? "Financial Analytics" : "Financial Dashboard"}</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>{periodLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIME_FILTERS.map(r => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id)}
              className={timeRange === r.id ? "btn-primary" : "btn-secondary"}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero card */}
      {!analyticsOnly && (
        <div className="card hero-card" style={{ marginBottom: 24 }}>
          <div className="hero-label">
            <DollarSign size={16} />
            {hasBalanceData ? "Closing Balance" : "Net Cash Flow"}
          </div>
          <div className="hero-amount">
            {money(hasBalanceData ? closingBalance : net)}
          </div>
          <div className={`hero-change ${net >= 0 ? "positive" : "negative"}`}>
            {net >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {hasBalanceData && openingBalance !== null
              ? `Opened at ${money(openingBalance)} · Net ${net >= 0 ? "+" : ""}${money(net)}`
              : income > 0 ? `${savingsRate}% savings rate` : "No income recorded yet"}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="account-grid" style={{ marginBottom: 24 }}>
        {kpiCards.map(({ label, val, change, type, Icon, isCount, isCash }) => (
          <div className="card account-card" key={label}
            style={{ borderTop: `3px solid ${isCash ? '#f59e0b' : kpiColors[type]}` }}>
            <div className="account-card-header">
              <span className="account-label">{label}</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: isCash ? '#fef3c7' : kpiBgColors[type], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color: isCash ? '#f59e0b' : kpiColors[type] }} />
              </div>
            </div>
            <div className="account-amount">
              {isCount ? val : money(val)}
            </div>
            <div className={`account-change ${type}`} style={{ fontSize: 12 }}>
              {isCash ? <span style={{ color: '#a78bfa', fontWeight: 600 }}>✦ Not in bank · Physical</span> : change}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="chart-card-header">
            <div>
              <div className="chart-title">Spending Breakdown</div>
              <div className="chart-subtitle">By category</div>
            </div>
          </div>
          {pieRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>No expense data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieRows} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                  {pieRows.map((r) => (
                    <Cell key={r.name} fill={CATEGORY_COLORS[r.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="chart-card-header">
            <div>
              <div className="chart-title">Income vs Expenses</div>
              <div className="chart-subtitle">Last {dayRows.length} days</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dayRows} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Income"   fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly area chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="chart-card-header">
          <div>
            <div className="chart-title">Monthly Cash Flow</div>
            <div className="chart-subtitle">Income and expenses across {summary?.months_covered || 0} month(s)</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthRows.length > 1 ? monthRows : dayRows}>
            <defs>
              <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={monthRows.length > 1 ? "month" : "date"} tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area dataKey="Income"   stroke="#10b981" fill="url(#gInc)" strokeWidth={2.5} dot={false} />
            <Area dataKey="Expenses" stroke="#f43f5e" fill="url(#gExp)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI Insights */}
      {!analyticsOnly && <ProactiveInsights />}

      {/* Rule-based insights */}
      {(summary?.insights || []).length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="chart-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} style={{ color: 'var(--accent)' }} /> Actionable Insights
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {summary.insights.map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'var(--accent-light)', borderRadius: 12, borderLeft: '3px solid var(--accent)' }}>
                <AlertCircle size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics extra */}
      {analyticsOnly && (
        <div className="account-grid" style={{ marginTop: 24 }}>
          {[
            { name: "Balance / Net",   val: hasBalanceData ? money(closingBalance) : money(net), sub: hasBalanceData && openingBalance !== null ? `Opened at ${money(openingBalance)}` : savingsRate > 0 ? `+${savingsRate}% savings` : "—", Icon: DollarSign },
            { name: "Savings Rate",    val: `${savingsRate}%`,       sub: "This period",                         Icon: PiggyBank },
            { name: "Total Expenses",  val: money(expenses),         sub: `${pieRows.length} categories`,         Icon: BarChart3 },
            { name: "Top Category",    val: topCat,                  sub: money(byCategory[topCat] || 0),        Icon: Target },
          ].map(({ name, val, sub, Icon }) => (
            <div className="card account-card" key={name}>
              <div className="account-card-header">
                <span className="account-label">{name}</span>
                <Icon size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="account-amount" style={{ fontSize: 22 }}>{val}</div>
              <div className="account-change muted">{sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
