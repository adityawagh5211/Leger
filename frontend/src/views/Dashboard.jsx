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

  const income = Number(summary?.income || 0);
  const expenses = Number(summary?.expenses || 0);
  const net = Number(summary?.net || 0);
  const saved = Math.max(0, income - expenses);
  const savingsRate = income > 0 ? Math.round((saved / income) * 100) : 0;
  const periodLabel = summary?.period_start && summary?.period_end
    ? `${summary.period_start} to ${summary.period_end}`
    : "All available transactions";

  // Use bank-reported balances when available (from statement imports with Balance column)
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

  // Cash transactions (manually entered, NOT from bank statement)
  const cashIncome = Number(summary?.cash_income || 0);
  const cashExpenses = Number(summary?.cash_expenses || 0);
  const cashNet = Number(summary?.cash_net || 0);
  const hasCash = cashIncome > 0 || cashExpenses > 0;

  const kpiCards = [
    { label: "Total Income", val: income, change: periodLabel, type: "positive", Icon: TrendingUp },
    { label: "Total Expenses", val: expenses, change: periodLabel, type: "negative", Icon: TrendingDown },
    { label: "Money Saved", val: saved, change: income > 0 ? `${savingsRate}% of income` : "—", type: "positive", Icon: PiggyBank },
    { label: "Recurring", val: summary?.recurring?.length || 0, change: "Payments detected", type: "muted", Icon: Calendar },
    ...(hasCash ? [{
      label: "Cash on Hand",
      val: cashNet,
      change: cashExpenses > 0 ? `In: ${money(cashIncome)} · Out: ${money(cashExpenses)}` : `Received ${money(cashIncome)} in cash`,
      type: cashNet >= 0 ? "positive" : "negative",
      Icon: Banknote,
      isCash: true,
    }] : []),
  ];

  return (
    <div className="view-dashboard">
      <div className="page-title-block">
        <h1 className="page-title">{analyticsOnly ? "Financial Analytics" : "Financial Dashboard"}</h1>
        <p className="page-subtitle">{analyticsOnly ? `Detailed trends and patterns, ${periodLabel}` : `Your financial picture from ${periodLabel}`}</p>
      </div>

      <div className="filter-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          { id: 'this_month', label: 'This Month' },
          { id: '3m', label: '3 Months' },
          { id: 'current_year', label: 'Current Year' },
          { id: 'all', label: 'All Time' },
        ].map(r => (
          <button
            key={r.id}
            onClick={() => setTimeRange(r.id)}
            className={`btn-secondary ${timeRange === r.id ? 'active' : ''}`}
            style={timeRange === r.id ? { backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)', fontWeight: 500 } : { fontWeight: 500 }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Net worth hero */}
      {!analyticsOnly && (
        <div className="card hero-card">
          {hasBalanceData ? (
            <>
              <div className="hero-label"><DollarSign size={15} /> Closing Balance</div>
              <div className="hero-amount">{money(closingBalance)}</div>
              <div className={`hero-change ${net >= 0 ? "positive" : "negative"}`}>
                {net >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {openingBalance !== null
                  ? `Opened at ${money(openingBalance)} · Net flow ${net >= 0 ? "+" : ""}${money(net)}`
                  : `Net flow ${net >= 0 ? "+" : ""}${money(net)}`}
              </div>
            </>
          ) : (
            <>
              <div className="hero-label"><DollarSign size={15} /> Net Cash Flow</div>
              <div className="hero-amount">{money(net)}</div>
              <div className={`hero-change ${net >= 0 ? "positive" : "negative"}`}>
                {net >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {income > 0 ? `${savingsRate}% savings rate` : "No income recorded yet"}
              </div>
            </>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="account-grid">
        {kpiCards.map(({ label, val, change, type, Icon, isCash }) => (
          <div
            className="card account-card"
            key={label}
            style={isCash ? {
              borderLeft: "3px solid #f59e0b",
              background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, var(--card-bg) 100%)"
            } : {}}
          >
            <div className="account-card-header">
              <span className="account-label">{label}</span>
              <Icon size={20} className={`icon-${type}`} style={isCash ? { color: "#f59e0b" } : {}} />
            </div>
            <div className="account-amount">
              {label === "Recurring" ? val : money(val)}
            </div>
            <div className={`account-change ${type}`}>
              {isCash ? (
                <span style={{ color: "#a78bfa", fontSize: "11px" }}>
                  ✦ Not in bank balance · Physical cash
                </span>
              ) : null}
              {change}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="chart-card-header">
            <div>
              <div className="chart-title">Spending Breakdown</div>
              <div className="chart-subtitle">By category</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieRows} dataKey="value" innerRadius={60} outerRadius={95} paddingAngle={3}>
                {pieRows.map((r) => (
                  <Cell key={r.name} fill={CATEGORY_COLORS[r.name] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => money(v)} />
              <Legend iconSize={10} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="chart-card-header">
            <div>
              <div className="chart-title">Income vs Expenses</div>
              <div className="chart-subtitle">Last {dayRows.length} days</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dayRows} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Area trend */}
      <div className="card">
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
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey={monthRows.length > 1 ? "month" : "date"} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => money(v)} />
            <Area dataKey="Income" stroke="#10b981" fill="url(#gInc)" strokeWidth={2} />
            <Area dataKey="Expenses" stroke="#fb7185" fill="url(#gExp)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Proactive AI Insights */}
      {!analyticsOnly && <ProactiveInsights />}

      {/* Rule-based Insights */}
      {(summary?.insights || []).length > 0 && (
        <div className="card">
          <div className="chart-title" style={{ marginBottom: 14 }}>Actionable Insights</div>
          <div className="insights-list">
            {summary.insights.map((item) => (
              <div className="insight-item" key={item}>
                <AlertCircle size={15} className="icon-accent" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics extra: top categories */}
      {analyticsOnly && (
        <div className="account-grid">
          {[
            { name: "Closing Balance", val: hasBalanceData ? money(closingBalance) : money(net), sub: hasBalanceData && openingBalance !== null ? `Opened at ${money(openingBalance)}` : savingsRate > 0 ? `+${savingsRate}% savings` : "—", Icon: DollarSign },
            { name: "Savings Rate", val: `${savingsRate}%`, sub: "This period", Icon: PiggyBank },
            { name: "Total Expenses", val: money(expenses), sub: `${pieRows.length} categories`, Icon: BarChart3 },
            { name: "Top Category", val: topCat, sub: money(byCategory[topCat] || 0), Icon: Target },
          ].map(({ name, val, sub, Icon }) => (
            <div className="card analytics-stat-card" key={name}>
              <div className="analytics-stat-card-top">
                <div className="analytics-stat-name">{name}</div>
                <Icon size={18} className="analytics-stat-icon" />
              </div>
              <div className="analytics-stat-value">{val}</div>
              <div className="analytics-stat-sub">{sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
