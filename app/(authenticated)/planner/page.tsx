"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAppSession } from "../../../components/app-shell";
import { EmptyState, Notice, Panel, Pill } from "../../../components/ui";
import { apiRequest } from "../../../lib/client";
import { minorUnits, money, today } from "../../../lib/ledger";
import { PlannerForecast } from "../../../lib/planner";

export default function PlannerPage() {
  const { serverUrl, session, me } = useAppSession();
  const canSave = me.role === "owner" || me.role === "manager";
  const [forecast, setForecast] = useState<PlannerForecast | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [horizon, setHorizon] = useState(30);
  const [buffer, setBuffer] = useState("0.00");
  const [includePending, setIncludePending] = useState(true);

  const request = useCallback(<T,>(path: string, init: RequestInit = {}) => apiRequest<T>(serverUrl, path, init, session.access_token), [serverUrl, session.access_token]);
  const body = useCallback(() => ({
    as_of_date: today(),
    horizon_days: horizon,
    currency_code: currency,
    cash_buffer_minor: minorUnits(buffer) ?? 0,
    include_pending: includePending,
  }), [buffer, currency, horizon, includePending]);

  const run = useCallback(async () => {
    setBusy(true); setNotice("");
    try {
      setForecast(await request<PlannerForecast>("/v1/planner/forecast", { method: "POST", body: JSON.stringify(body()) }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The forecast could not be calculated.");
    } finally { setBusy(false); }
  }, [body, request]);

  useEffect(() => { void run(); }, [run]);

  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await run(); }
  async function save() {
    setBusy(true); setNotice("");
    try {
      const saved = await request<PlannerForecast>("/v1/planner/snapshots", { method: "POST", body: JSON.stringify(body()) });
      setForecast(saved); setNotice("Forecast snapshot saved. Its inputs and rule version can now be reproduced.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The snapshot could not be saved."); }
    finally { setBusy(false); }
  }

  const cash = (value: number) => money(value, forecast?.currency_code ?? currency);
  return <div className="planner-page">
    <header className="page-header"><div><p className="eyebrow">Deterministic cash forecast</p><h1>Cash Planner</h1></div>{forecast && <Pill tone={forecast.shortfalls.length ? "red" : "green"}>{forecast.shortfalls.length ? `${forecast.shortfalls.length} shortfall warning${forecast.shortfalls.length === 1 ? "" : "s"}` : "Plan is funded"}</Pill>}</header>
    {notice && <p className="status-message">{notice}</p>}
    <form className="planner-controls" onSubmit={submit}>
      <label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>CAD</option><option>MXN</option></select></label>
      <label>Horizon<select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label>
      <label>Protected cash buffer<input inputMode="decimal" value={buffer} onChange={(event) => setBuffer(event.target.value)} /></label>
      <label className="checkbox-line planner-pending"><input type="checkbox" checked={includePending} onChange={(event) => setIncludePending(event.target.checked)} /> Include pending activity</label>
      <button className="button primary" disabled={busy}>Recalculate</button>
      {canSave && <button type="button" className="button" disabled={busy || !forecast} onClick={() => void save()}>Save snapshot</button>}
    </form>
    {!forecast ? <EmptyState title="Calculating forecast">Tallystead is gathering eligible cash, expected income, and unpaid obligations.</EmptyState> : <div className="grid">
      <Panel span={4} className="planner-safe"><p className="eyebrow">Safe to spend</p><p className="amount">{cash(forecast.safe_to_spend_minor)}</p><small>Through {forecast.horizon_date}, after the {cash(forecast.cash_buffer_minor)} buffer.</small></Panel>
      <Panel span={4}><p className="eyebrow">Planning cash</p><p className="amount">{cash(forecast.planning_balance_minor)}</p><small>{forecast.accounts.length} eligible account{forecast.accounts.length === 1 ? "" : "s"}; {forecast.include_pending ? "pending activity included" : "posted activity only"}.</small></Panel>
      <Panel span={4}><p className="eyebrow">Reserved now</p><p className="amount">{cash(forecast.reserved_now_minor)}</p><small>Allocation only—this does not create or move money.</small></Panel>

      {forecast.shortfalls.length > 0 && <Panel span={12} className="shortfall-panel"><p className="eyebrow">Needs attention</p><h2>Forecast shortfalls</h2>{forecast.shortfalls.map((item, index) => <div className="row" key={`${item.event_date}-${index}`}><div><b>{item.obligation_name}</b><small>{item.event_date} · {item.explanation}</small></div><strong className="negative">{cash(item.amount_minor)} short</strong></div>)}</Panel>}

      <Panel span={7}><p className="eyebrow">Forecast timeline</p><h2>{forecast.as_of_date} through {forecast.horizon_date}</h2>{forecast.timeline.length === 0 ? <EmptyState title="No forecast events">Add expected income or upcoming bills for this currency and horizon.</EmptyState> : <div className="planner-timeline">{forecast.timeline.map((item, index) => <div className="timeline-row" key={`${item.item_id}-${index}`}><div className={`timeline-mark ${item.item_type}`}>{item.item_type === "income" ? "+" : "−"}</div><div><b>{item.name}</b><small>{item.event_date} · {item.explanation}</small></div><div className="timeline-values"><strong className={item.amount_minor >= 0 ? "positive" : ""}>{cash(item.amount_minor)}</strong><small>{cash(item.projected_balance_minor)} projected</small></div></div>)}</div>}</Panel>
      <Panel span={5}><p className="eyebrow">Reserve breakdown</p><h2>Required obligations</h2>{forecast.reserves.length === 0 ? <EmptyState title="Nothing to reserve">No unpaid obligations fall inside this horizon.</EmptyState> : forecast.reserves.map((item) => <div className="reserve-row" key={item.bill_instance_id}><div className="title-with-status"><b>{item.name}</b><Pill tone={item.status === "funded" ? "green" : "red"}>{item.status}</Pill></div><div className="metric-row"><span>Due {item.due_date}</span><strong>{cash(item.required_minor)}</strong></div><small>{item.explanation}</small></div>)}</Panel>

      <Panel span={6}><p className="eyebrow">Scope and assumptions</p><h2>What is included</h2>{forecast.accounts.map((account) => <div className="metric-row" key={account.account_id}><span>{account.name}</span><b>{cash(account.balance_minor)}</b></div>)}<Notice title="Protected boundary">Credit availability, business cash, restricted funds, investments, liabilities, and other currencies never become safe-to-spend.</Notice></Panel>
      <Panel span={6}><p className="eyebrow">Explanation trace</p><h2>Warnings and calculation rules</h2>{forecast.warnings.map((warning) => <p className="planner-warning" key={warning}>{warning}</p>)}{forecast.assumptions.map((assumption) => <p className="planner-assumption" key={assumption}>{assumption}</p>)}<small className="planner-hash">Rule {forecast.rule_version} · input {forecast.input_hash.slice(0, 12)}{forecast.snapshot_id ? ` · snapshot ${forecast.snapshot_id.slice(0, 8)}` : " · preview"}</small></Panel>
    </div>}
  </div>;
}
