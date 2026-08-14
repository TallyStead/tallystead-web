"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "../../../components/app-shell";
import { EmptyState, Notice, Panel, Pill } from "../../../components/ui";
import QuickTransaction from "../../../components/quick-transaction";
import { apiRequest } from "../../../lib/client";
import { Account, Category, money, NetWorth } from "../../../lib/ledger";

export default function OverviewPage() {
  const { serverUrl, session, me } = useAppSession();
  const [currency, setCurrency] = useState("USD");
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quickEntry, setQuickEntry] = useState(false);
  const [error, setError] = useState(""),[notice,setNotice]=useState("");
  const load = useCallback(async () => {
    try { const [position,accountList,categoryList]=await Promise.all([apiRequest<NetWorth>(serverUrl, `/v1/ledger/net-worth?currency_code=${currency}`, {}, session.access_token),apiRequest<Account[]>(serverUrl,"/v1/ledger/accounts",{},session.access_token),apiRequest<Category[]>(serverUrl,"/v1/ledger/categories",{},session.access_token)]);setNetWorth(position);setAccounts(accountList);setCategories(categoryList);setError(""); }
    catch (value) { setError(value instanceof Error ? value.message : "Net worth could not be loaded."); }
  }, [currency, serverUrl, session.access_token]);
  useEffect(() => { void load(); }, [load]);

  return <div className="ledger-page overview-page">
    {error && <Notice title="Overview unavailable">{error}</Notice>}
    {notice&&<Notice title="Transaction">{notice}</Notice>}
    <div className="ledger-toolbar overview-toolbar"><div><b>Household position</b><small>Net worth uses ledger balances and the latest dated account valuations. Currencies are never combined silently.</small></div><div className="overview-actions">{(me.role==="owner"||me.role==="manager")&&<button className="button primary" onClick={()=>{setQuickEntry(true);setNotice("")}}>+ Add transaction</button>}<label className="currency-filter">Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>CAD</option><option>MXN</option></select></label></div></div>
    {quickEntry&&<QuickTransaction accounts={accounts} categories={categories} onCancel={()=>setQuickEntry(false)} onComplete={async message=>{setNotice(message);setQuickEntry(false);await load()}}/>}
    <div className="grid">
      <Panel span={4} className="metric"><small>Assets</small><div className="amount">{netWorth ? money(netWorth.asset_total_minor,currency) : "—"}</div><Pill>Included accounts</Pill></Panel>
      <Panel span={4} className="metric"><small>Liabilities</small><div className="amount">{netWorth ? money(netWorth.liability_total_minor,currency) : "—"}</div><Pill tone="amber">Outstanding</Pill></Panel>
      <Panel span={4} className="metric"><small>Net worth</small><div className="amount">{netWorth ? money(netWorth.net_worth_minor,currency) : "—"}</div><Pill tone="blue">As of {netWorth?.as_of ?? "today"}</Pill></Panel>
      <Panel span={7}><div className="title-with-status"><div><p className="eyebrow">Account basis</p><h2>Net-worth accounts</h2></div><Link className="button compact" href="/transactions">Manage accounts</Link></div>{!netWorth?.accounts.length ? <EmptyState title="No accounts in this currency">Create an account or enable net-worth inclusion from account management.</EmptyState> : netWorth.accounts.map((item) => <div className="row" key={item.account_id}><span><b>{item.name}</b><small>{item.account_type.replaceAll("_"," ")} · {item.ownership_scope} · {item.liquidity}{item.valuation_as_of ? ` · valued ${item.valuation_as_of}` : " · ledger balance"}</small></span><b className={item.value_minor < 0 ? "negative-value" : ""}>{money(item.value_minor,item.currency_code)}</b></div>)}</Panel>
      <Panel span={5}><p className="eyebrow">Scope separation</p><h2>Household and business</h2><div className="metric-row"><span>Household</span><b>{netWorth ? money(netWorth.household_net_worth_minor,currency) : "—"}</b></div><div className="metric-row"><span>Business</span><b>{netWorth ? money(netWorth.business_net_worth_minor,currency) : "—"}</b></div><Notice title="Cash Planner protection">Only household-owned, spendable asset accounts explicitly enabled for planning can contribute to safe-to-spend.</Notice></Panel>
    </div>
  </div>;
}
