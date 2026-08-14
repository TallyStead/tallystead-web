"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAppSession } from "../../../components/app-shell";
import { EmptyState, Notice, Panel, Pill } from "../../../components/ui";
import { apiRequest } from "../../../lib/client";
import { Account, minorUnits, money, Transaction } from "../../../lib/ledger";
import {
  BillInstance,
  BillProfile,
  CalendarItem,
  Debt,
  IncomeEvent,
  IncomeSource,
} from "../../../lib/obligations";

type Tab = "upcoming" | "bills" | "income" | "debts";
const cadenceOptions = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
  "irregular",
];

function isoOffset(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function AmountRangeFields() {
  return (
    <div className="form-grid obligation-amounts">
      <label>
        Expected amount
        <input
          name="expected"
          inputMode="decimal"
          placeholder="0.00"
          required
        />
      </label>
      <label>
        Minimum
        <input name="minimum" inputMode="decimal" placeholder="Optional" />
      </label>
      <label>
        Maximum
        <input name="maximum" inputMode="decimal" placeholder="Optional" />
      </label>
    </div>
  );
}

export default function BillsPage() {
  const { serverUrl, session, me } = useAppSession();
  const canWrite = me.role === "owner" || me.role === "manager";
  const [tab, setTab] = useState<Tab>("upcoming");
  const [profiles, setProfiles] = useState<BillProfile[]>([]);
  const [instances, setInstances] = useState<BillInstance[]>([]);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [events, setEvents] = useState<IncomeEvent[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(
    <T,>(path: string, init: RequestInit = {}) =>
      apiRequest<T>(serverUrl, path, init, session.access_token),
    [serverUrl, session.access_token],
  );
  const load = useCallback(async () => {
    const [p, i, s, e, d, c, t, a] = await Promise.all([
      request<BillProfile[]>("/v1/obligations/bill-profiles"),
      request<BillInstance[]>("/v1/obligations/bill-instances"),
      request<IncomeSource[]>("/v1/obligations/income-sources"),
      request<IncomeEvent[]>("/v1/obligations/income-events"),
      request<Debt[]>("/v1/obligations/debts"),
      request<CalendarItem[]>(
        `/v1/obligations/calendar?date_from=${isoOffset(-30)}&date_to=${isoOffset(120)}`,
      ),
      request<Transaction[]>("/v1/ledger/transactions"),
      request<Account[]>("/v1/ledger/accounts"),
    ]);
    setProfiles(p);
    setInstances(i);
    setSources(s);
    setEvents(e);
    setDebts(d);
    setCalendar(c);
    setTransactions(t);
    setAccounts(a);
  }, [request]);
  useEffect(() => {
    void load().catch((error: Error) => setNotice(error.message));
  }, [load]);

  async function act(path: string, init: RequestInit, message: string) {
    setBusy(true);
    setNotice("");
    try {
      await request(path, init);
      setNotice(message);
      await load();
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The obligation could not be updated.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function amount(data: FormData, name: string) {
    const raw = data.get(name)?.toString() ?? "";
    return raw ? minorUnits(raw) : null;
  }

  async function addBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await act(
      "/v1/obligations/bill-profiles",
      {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          payee: data.get("payee") || null,
          cadence: data.get("cadence"),
          next_due_date: data.get("next_date"),
          expected_amount_minor: amount(data, "expected"),
          minimum_amount_minor: amount(data, "minimum"),
          maximum_amount_minor: amount(data, "maximum"),
          currency_code: data.get("currency"),
          is_essential: data.has("essential"),
          priority: Number(data.get("priority")),
        }),
      },
      "Bill profile created. Generate the horizon to place its dated obligations on the calendar.",
    );
    if (ok) form.reset();
  }
  async function addIncomeSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await act(
      "/v1/obligations/income-sources",
      {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          payer: data.get("payer") || null,
          cadence: data.get("cadence"),
          next_expected_date: data.get("next_date"),
          expected_amount_minor: amount(data, "expected"),
          minimum_amount_minor: amount(data, "minimum"),
          maximum_amount_minor: amount(data, "maximum"),
          currency_code: data.get("currency"),
          confidence_percent: Number(data.get("confidence")),
        }),
      },
      "Income source created. Expected income remains separate from confirmed balances.",
    );
    if (ok) form.reset();
  }
  async function addManualIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await act(
      "/v1/obligations/income-events",
      {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          expected_date: data.get("date"),
          expected_amount_minor: amount(data, "expected"),
          currency_code: data.get("currency"),
          confidence_percent: Number(data.get("confidence")),
          note: data.get("note") || null,
        }),
      },
      "Irregular expected income added without changing an account balance.",
    );
    if (ok) form.reset();
  }
  async function addDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const selected = accounts.find(
      (item) => item.account_id === data.get("account_id"),
    );
    const ok = await act(
      "/v1/obligations/debts",
      {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          lender: data.get("lender") || null,
          account_id: data.get("account_id") || null,
          balance_minor: amount(data, "balance"),
          apr_basis_points: Math.round(Number(data.get("apr")) * 100),
          minimum_payment_minor: amount(data, "minimum"),
          due_day: Number(data.get("due_day")),
          next_due_date: data.get("next_date"),
          currency_code: selected?.currency_code ?? data.get("currency"),
        }),
      },
      "Debt created. Its balance remains distinct from minimum-payment obligations.",
    );
    if (ok) form.reset();
  }
  async function generate() {
    await act(
      `/v1/obligations/generate?through=${isoOffset(90)}`,
      { method: "POST" },
      "Upcoming bills, income, and debt minimums generated through the next 90 days without duplicates.",
    );
  }

  const outflows = transactions.filter(
    (item) =>
      item.amount_minor < 0 && item.status === "posted" && !item.transfer_id,
  );
  const inflows = transactions.filter(
    (item) =>
      item.amount_minor > 0 && item.status === "posted" && !item.transfer_id,
  );

  return (
    <div className="ledger-page obligations-page">
      {notice && <Notice title="Bills and calendar update">{notice}</Notice>}
      <div className="ledger-toolbar">
        <div>
          <b>Future commitments</b>
          <small>
            Expectations never change confirmed balances until linked to
            observed ledger transactions.
          </small>
        </div>
        {canWrite && (
          <button className="button primary" disabled={busy} onClick={generate}>
            Generate next 90 days
          </button>
        )}
      </div>
      <nav className="ledger-tabs" aria-label="Bills and income sections">
        {(
          [
            ["upcoming", "Upcoming"],
            ["bills", "Bill profiles"],
            ["income", "Income"],
            ["debts", "Debts"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "upcoming" && (
        <div className="grid">
          <Panel span={8}>
            <div className="title-with-status">
              <div>
                <p className="eyebrow">Calendar horizon</p>
                <h2>Upcoming activity</h2>
              </div>
              <Pill tone="blue">{calendar.length} events</Pill>
            </div>
            {calendar.length === 0 ? (
              <EmptyState title="Nothing scheduled yet">
                Create profiles or income sources, then generate the next 90
                days.
              </EmptyState>
            ) : (
              <div className="calendar-list">
                {calendar.map((item) => (
                  <div
                    className="calendar-row"
                    key={`${item.item_type}-${item.item_id}`}
                  >
                    <time>
                      {new Date(
                        `${item.event_date}T12:00:00`,
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {item.item_type} · {item.status}
                        {item.priority ? ` · priority ${item.priority}` : ""}
                      </small>
                    </span>
                    <b className={item.amount_minor > 0 ? "inflow" : ""}>
                      {money(item.amount_minor, item.currency_code)}
                    </b>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel span={4}>
            <p className="eyebrow">At a glance</p>
            <h2>Obligations</h2>
            <div className="metric-row">
              <span>Unpaid bills</span>
              <b>
                {
                  instances.filter(
                    (item) => !["paid", "skipped"].includes(item.status),
                  ).length
                }
              </b>
            </div>
            <div className="metric-row">
              <span>Partial payments</span>
              <b>
                {instances.filter((item) => item.status === "partial").length}
              </b>
            </div>
            <div className="metric-row">
              <span>Expected income</span>
              <b>
                {events.filter((item) => item.status === "expected").length}
              </b>
            </div>
            <p className="field-help top-space">
              Debt balances and expected income are informational; neither
              creates ledger money movement.
            </p>
          </Panel>
        </div>
      )}

      {tab === "bills" && (
        <div className="grid">
          <Panel span={5}>
            <p className="eyebrow">Recurring obligation</p>
            <h2>Add bill profile</h2>
            {canWrite ? (
              <form onSubmit={addBill}>
                <label>
                  Name
                  <input name="name" required placeholder="Electric service" />
                </label>
                <label>
                  Payee
                  <input name="payee" placeholder="Utility provider" />
                </label>
                <div className="form-grid">
                  <label>
                    Cadence
                    <select name="cadence">
                      {cadenceOptions.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Next due
                    <input
                      type="date"
                      name="next_date"
                      defaultValue={isoOffset(7)}
                      required
                    />
                  </label>
                </div>
                <AmountRangeFields />
                <div className="form-grid">
                  <label>
                    Currency
                    <select name="currency">
                      <option>USD</option>
                      <option>CAD</option>
                      <option>MXN</option>
                    </select>
                  </label>
                  <label>
                    Priority
                    <select name="priority" defaultValue="3">
                      <option value="1">1 · highest</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5 · lowest</option>
                    </select>
                  </label>
                </div>
                <label className="checkbox-line">
                  <input type="checkbox" name="essential" /> Essential
                  obligation
                </label>
                <button className="button primary" disabled={busy}>
                  Create bill profile
                </button>
              </form>
            ) : (
              <p className="empty-inline">
                Your role can inspect bills but cannot change them.
              </p>
            )}
          </Panel>
          <Panel span={7}>
            <p className="eyebrow">Recurring schedules</p>
            <h2>Bill profiles</h2>
            {profiles.length === 0 ? (
              <p className="empty-inline">No bill profiles created yet.</p>
            ) : (
              profiles.map((profile) => (
                <details className="obligation-card profile-card" key={profile.bill_profile_id}>
                  <summary>
                    <span><b>{profile.name}</b><small>{profile.cadence} · next {profile.next_due_date || "not scheduled"}{profile.is_active ? "" : " · inactive"}</small></span>
                    <b>{money(profile.expected_amount_minor, profile.currency_code)}</b>
                  </summary>
                  {canWrite && <div className="profile-management">
                    <form onSubmit={(event) => {
                      event.preventDefault(); const data = new FormData(event.currentTarget);
                      void act(`/v1/obligations/bill-profiles/${profile.bill_profile_id}`, { method: "PATCH", body: JSON.stringify({ name: data.get("name"), payee: data.get("payee") || null, cadence: data.get("cadence"), next_due_date: data.get("next_date") || null, expected_amount_minor: amount(data,"expected"), minimum_amount_minor: amount(data,"minimum"), maximum_amount_minor: amount(data,"maximum"), priority: Number(data.get("priority")), is_essential: data.has("essential"), is_active: data.has("active") }) }, "Bill profile updated. Existing dated instances retain their own historical values.");
                    }}>
                      <div className="form-grid"><label>Name<input name="name" defaultValue={profile.name} required /></label><label>Payee<input name="payee" defaultValue={profile.payee ?? ""} /></label><label>Cadence<select name="cadence" defaultValue={profile.cadence}>{cadenceOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Next due<input type="date" name="next_date" defaultValue={profile.next_due_date ?? ""} /></label></div>
                      <div className="form-grid obligation-amounts"><label>Expected<input name="expected" defaultValue={(profile.expected_amount_minor/100).toFixed(2)} required /></label><label>Minimum<input name="minimum" defaultValue={profile.minimum_amount_minor === null ? "" : (profile.minimum_amount_minor/100).toFixed(2)} /></label><label>Maximum<input name="maximum" defaultValue={profile.maximum_amount_minor === null ? "" : (profile.maximum_amount_minor/100).toFixed(2)} /></label></div>
                      <label>Priority<select name="priority" defaultValue={String(profile.priority)}>{[1,2,3,4,5].map((item) => <option key={item}>{item}</option>)}</select></label>
                      <div className="row-actions profile-checks"><label className="checkbox-line"><input type="checkbox" name="essential" defaultChecked={profile.is_essential} /> Essential</label><label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={profile.is_active} /> Active schedule</label></div>
                      <button className="button primary" disabled={busy}>Save profile</button>
                    </form>
                    <div className="danger-zone"><b>Remove this bill profile</b><p>Upcoming only removes unlinked future instances and stops this schedule. Delete all removes every instance and payment link for this profile. Ledger transactions are always preserved.</p><div className="row-actions"><button className="button" disabled={busy} onClick={() => { if (window.confirm(`Remove upcoming instances for ${profile.name} and stop this schedule?`)) void act(`/v1/obligations/bill-profiles/${profile.bill_profile_id}?scope=upcoming`, {method:"DELETE"}, "Upcoming bill instances removed and the profile deactivated."); }}>Remove upcoming only</button><button className="button danger" disabled={busy} onClick={() => { if (window.confirm(`Permanently delete ${profile.name}, all of its bill instances, and their payment links? Ledger transactions will remain.`)) void act(`/v1/obligations/bill-profiles/${profile.bill_profile_id}?scope=all`, {method:"DELETE"}, "Bill profile and all of its bill history deleted; ledger transactions were preserved."); }}>Delete profile and all</button></div></div>
                  </div>}
                </details>
              ))
            )}
            <p className="eyebrow top-space">Dated obligations</p>
            <h2>Bill instances</h2>
            {instances.length === 0 ? (
              <p className="empty-inline">No bill instances generated yet.</p>
            ) : (
              instances.map((item) => (
                <details
                  className="obligation-card"
                  key={item.bill_instance_id}
                >
                  <summary>
                    <span>
                      <b>{item.name}</b>
                      <small>
                        Due{" "}
                        {new Date(
                          `${item.due_date}T12:00:00`,
                        ).toLocaleDateString()}{" "}
                        · {item.status}
                      </small>
                    </span>
                    <span>
                      {money(item.paid_amount_minor, item.currency_code)} /{" "}
                      {money(item.expected_amount_minor, item.currency_code)}
                    </span>
                  </summary>
                  {canWrite && (
                    <div className="obligation-actions">
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void act(
                            `/v1/obligations/bill-instances/${item.bill_instance_id}`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({
                                expected_amount_minor: amount(data, "expected"),
                                note: data.get("note") || null,
                              }),
                            },
                            "Bill expectation updated for this instance only.",
                          );
                        }}
                      >
                        <label>
                          Changed expected amount
                          <input
                            name="expected"
                            defaultValue={(
                              item.expected_amount_minor / 100
                            ).toFixed(2)}
                          />
                        </label>
                        <label>
                          Reason or note
                          <input name="note" defaultValue={item.note ?? ""} />
                        </label>
                        <button className="button">Save instance change</button>
                      </form>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void act(
                            `/v1/obligations/bill-instances/${item.bill_instance_id}/payments`,
                            {
                              method: "POST",
                              body: JSON.stringify({
                                transaction_id: data.get("transaction_id"),
                                amount_minor: amount(data, "amount"),
                              }),
                            },
                            "Observed payment linked to this bill.",
                          );
                        }}
                      >
                        <label>
                          Observed payment
                          <select name="transaction_id" required>
                            <option value="">Select an outflow</option>
                            {outflows
                              .filter(
                                (txn) =>
                                  txn.currency_code === item.currency_code,
                              )
                              .map((txn) => (
                                <option
                                  key={txn.transaction_id}
                                  value={txn.transaction_id}
                                >
                                  {txn.transaction_date} ·{" "}
                                  {txn.payee || txn.account_name} ·{" "}
                                  {money(txn.amount_minor, txn.currency_code)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Amount to apply
                          <input name="amount" inputMode="decimal" required />
                        </label>
                        <button className="button primary">Link payment</button>
                      </form>
                      <button
                        className="button compact"
                        onClick={() =>
                          act(
                            `/v1/obligations/bill-instances/${item.bill_instance_id}`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({ status: "skipped" }),
                            },
                            "Bill instance skipped; its profile remains active.",
                          )
                        }
                      >
                        Skip this instance
                      </button>
                    </div>
                  )}
                </details>
              ))
            )}
          </Panel>
        </div>
      )}

      {tab === "income" && (
        <div className="grid">
          <Panel span={5}>
            <p className="eyebrow">Recurring expectation</p>
            <h2>Add income source</h2>
            {canWrite && (
              <form onSubmit={addIncomeSource}>
                <label>
                  Name
                  <input name="name" required placeholder="Primary paycheck" />
                </label>
                <label>
                  Payer
                  <input name="payer" />
                </label>
                <div className="form-grid">
                  <label>
                    Cadence
                    <select name="cadence">
                      {cadenceOptions.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Next expected
                    <input
                      type="date"
                      name="next_date"
                      defaultValue={isoOffset(7)}
                      required
                    />
                  </label>
                </div>
                <AmountRangeFields />
                <div className="form-grid">
                  <label>
                    Currency
                    <select name="currency">
                      <option>USD</option>
                      <option>CAD</option>
                      <option>MXN</option>
                    </select>
                  </label>
                  <label>
                    Confidence %
                    <input
                      type="number"
                      name="confidence"
                      min="0"
                      max="100"
                      defaultValue="100"
                    />
                  </label>
                </div>
                <button className="button primary">Create income source</button>
              </form>
            )}
          </Panel>
          <Panel span={7}>
            <p className="eyebrow">Recurring schedules</p>
            <h2>Income sources</h2>
            {sources.length === 0 ? (
              <p className="empty-inline">No income sources created yet.</p>
            ) : (
              sources.map((source) => (
                <details className="obligation-card profile-card" key={source.income_source_id}>
                  <summary>
                    <span><b>{source.name}</b><small>{source.payer || "No payer"} · {source.cadence} · next {source.next_expected_date || "not scheduled"}{source.is_active ? "" : " · inactive"}</small></span>
                    <b>{money(source.expected_amount_minor, source.currency_code)}</b>
                  </summary>
                  {canWrite && <div className="profile-management">
                    <form onSubmit={(event) => {
                      event.preventDefault(); const data = new FormData(event.currentTarget);
                      void act(`/v1/obligations/income-sources/${source.income_source_id}`, { method: "PATCH", body: JSON.stringify({ name: data.get("name"), payer: data.get("payer") || null, cadence: data.get("cadence"), next_expected_date: data.get("next_date") || null, expected_amount_minor: amount(data,"expected"), minimum_amount_minor: amount(data,"minimum"), maximum_amount_minor: amount(data,"maximum"), confidence_percent: Number(data.get("confidence")), is_active: data.has("active") }) }, "Income source updated. Existing dated income events retain their historical values.");
                    }}>
                      <div className="form-grid"><label>Name<input name="name" defaultValue={source.name} required /></label><label>Payer<input name="payer" defaultValue={source.payer ?? ""} /></label><label>Cadence<select name="cadence" defaultValue={source.cadence}>{cadenceOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Next expected<input type="date" name="next_date" defaultValue={source.next_expected_date ?? ""} /></label></div>
                      <div className="form-grid obligation-amounts"><label>Expected<input name="expected" defaultValue={(source.expected_amount_minor/100).toFixed(2)} required /></label><label>Minimum<input name="minimum" defaultValue={source.minimum_amount_minor === null ? "" : (source.minimum_amount_minor/100).toFixed(2)} /></label><label>Maximum<input name="maximum" defaultValue={source.maximum_amount_minor === null ? "" : (source.maximum_amount_minor/100).toFixed(2)} /></label></div>
                      <div className="form-grid"><label>Confidence %<input type="number" name="confidence" min="0" max="100" defaultValue={source.confidence_percent} /></label><label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={source.is_active} /> Active schedule</label></div>
                      <button className="button primary" disabled={busy}>Save income source</button>
                    </form>
                    <div className="danger-zone"><b>Remove this income source</b><p>Upcoming only removes unreceived future events and stops this schedule. Delete all removes every expected-income event and received link for this source. Ledger transactions are always preserved.</p><div className="row-actions"><button className="button" disabled={busy} onClick={() => { if (window.confirm(`Remove upcoming income events for ${source.name} and stop this schedule?`)) void act(`/v1/obligations/income-sources/${source.income_source_id}?scope=upcoming`, {method:"DELETE"}, "Upcoming income events removed and the source deactivated."); }}>Remove upcoming only</button><button className="button danger" disabled={busy} onClick={() => { if (window.confirm(`Permanently delete ${source.name} and all of its expected-income history? Ledger transactions will remain.`)) void act(`/v1/obligations/income-sources/${source.income_source_id}?scope=all`, {method:"DELETE"}, "Income source and all of its expected-income history deleted; ledger transactions were preserved."); }}>Delete source and all</button></div></div>
                  </div>}
                </details>
              ))
            )}
          </Panel>
          <Panel span={4}>
            <p className="eyebrow">One-time expectation</p>
            <h2>Add irregular income</h2>
            {canWrite && (
              <form onSubmit={addManualIncome}>
                <label>
                  Name
                  <input name="name" required placeholder="Freelance project" />
                </label>
                <label>
                  Expected date
                  <input
                    type="date"
                    name="date"
                    defaultValue={isoOffset(14)}
                    required
                  />
                </label>
                <label>
                  Expected amount
                  <input name="expected" inputMode="decimal" required />
                </label>
                <div className="form-grid">
                  <label>
                    Currency
                    <select name="currency">
                      <option>USD</option>
                      <option>CAD</option>
                      <option>MXN</option>
                    </select>
                  </label>
                  <label>
                    Confidence %
                    <input
                      type="number"
                      name="confidence"
                      min="0"
                      max="100"
                      defaultValue="50"
                    />
                  </label>
                </div>
                <label>
                  Note
                  <input name="note" />
                </label>
                <button className="button primary">Add expected income</button>
              </form>
            )}
          </Panel>
          <Panel span={8}>
            <p className="eyebrow">Expected versus received</p>
            <h2>Income events</h2>
            {events.length === 0 ? (
              <p className="empty-inline">No expected income yet.</p>
            ) : (
              events.map((item) => (
                <details className="obligation-card" key={item.income_event_id}>
                  <summary>
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {item.expected_date} · {item.confidence_percent}%
                        confidence · {item.status}
                      </small>
                    </span>
                    <b>
                      {money(item.expected_amount_minor, item.currency_code)}
                    </b>
                  </summary>
                  {canWrite && item.status !== "received" && (
                    <form
                      className="top-space"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void act(
                          `/v1/obligations/income-events/${item.income_event_id}/received`,
                          {
                            method: "PUT",
                            body: JSON.stringify({
                              transaction_id: data.get("transaction_id"),
                            }),
                          },
                          "Expected income linked to its observed ledger inflow.",
                        );
                      }}
                    >
                      <label>
                        Observed inflow
                        <select name="transaction_id" required>
                          <option value="">Select an inflow</option>
                          {inflows
                            .filter(
                              (txn) => txn.currency_code === item.currency_code,
                            )
                            .map((txn) => (
                              <option
                                key={txn.transaction_id}
                                value={txn.transaction_id}
                              >
                                {txn.transaction_date} ·{" "}
                                {txn.payee || txn.account_name} ·{" "}
                                {money(txn.amount_minor, txn.currency_code)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button className="button">
                        Mark received with evidence
                      </button>
                    </form>
                  )}
                </details>
              ))
            )}
          </Panel>
        </div>
      )}

      {tab === "debts" && (
        <div className="grid">
          <Panel span={5}>
            <p className="eyebrow">Tracked liability</p>
            <h2>Add debt</h2>
            {canWrite && (
              <form onSubmit={addDebt}>
                <label>
                  Name
                  <input name="name" required placeholder="Auto loan" />
                </label>
                <label>
                  Lender
                  <input name="lender" />
                </label>
                <label>
                  Related ledger account
                  <select name="account_id">
                    <option value="">No related account</option>
                    {accounts.map((item) => (
                      <option key={item.account_id} value={item.account_id}>
                        {item.name} · {item.currency_code}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Balance
                    <input name="balance" inputMode="decimal" required />
                  </label>
                  <label>
                    APR %
                    <input
                      name="apr"
                      inputMode="decimal"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label>
                    Minimum payment
                    <input name="minimum" inputMode="decimal" required />
                  </label>
                  <label>
                    Due day
                    <input
                      name="due_day"
                      type="number"
                      min="1"
                      max="31"
                      required
                    />
                  </label>
                  <label>
                    Next due
                    <input
                      name="next_date"
                      type="date"
                      defaultValue={isoOffset(30)}
                      required
                    />
                  </label>
                  <label>
                    Currency
                    <select name="currency">
                      <option>USD</option>
                      <option>CAD</option>
                      <option>MXN</option>
                    </select>
                  </label>
                </div>
                <button className="button primary">Create debt</button>
              </form>
            )}
          </Panel>
          <Panel span={7}>
            <p className="eyebrow">Balances and minimums</p>
            <h2>Debts</h2>
            {debts.length === 0 ? (
              <EmptyState title="No debts tracked">
                Add a debt to generate its minimum-payment obligations.
              </EmptyState>
            ) : (
              debts.map((item) => (
                <details className="obligation-card profile-card" key={item.debt_id}>
                  <summary>
                    <span><b>{item.name}</b><small>{item.lender || "No lender"} · {(item.apr_basis_points / 100).toFixed(2)}% APR · due day {item.due_day}{item.is_active ? "" : " · inactive"}</small></span>
                    <span><b>{money(item.balance_minor, item.currency_code)}</b><small>{money(item.minimum_payment_minor, item.currency_code)} minimum</small></span>
                  </summary>
                  {canWrite && <div className="profile-management">
                    <form onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const selected = accounts.find((account) => account.account_id === data.get("account_id"));
                      void act(`/v1/obligations/debts/${item.debt_id}`, { method: "PATCH", body: JSON.stringify({ name: data.get("name"), lender: data.get("lender") || null, account_id: data.get("account_id") || null, balance_minor: amount(data, "balance"), apr_basis_points: Math.round(Number(data.get("apr")) * 100), minimum_payment_minor: amount(data, "minimum"), due_day: Number(data.get("due_day")), next_due_date: data.get("next_date"), currency_code: selected?.currency_code ?? data.get("currency"), is_active: data.has("active") }) }, "Debt updated. Existing dated minimum-payment obligations retain their historical values.");
                    }}>
                      <div className="form-grid"><label>Name<input name="name" defaultValue={item.name} required /></label><label>Lender<input name="lender" defaultValue={item.lender ?? ""} /></label><label>Related ledger account<select name="account_id" defaultValue={item.account_id ?? ""}><option value="">No related account</option>{accounts.map((account) => <option key={account.account_id} value={account.account_id}>{account.name} · {account.currency_code}</option>)}</select></label><label>Currency<select name="currency" defaultValue={item.currency_code}><option>USD</option><option>CAD</option><option>MXN</option></select></label></div>
                      <div className="form-grid"><label>Balance<input name="balance" inputMode="decimal" defaultValue={(item.balance_minor / 100).toFixed(2)} required /></label><label>APR %<input name="apr" inputMode="decimal" defaultValue={(item.apr_basis_points / 100).toFixed(2)} required /></label><label>Minimum payment<input name="minimum" inputMode="decimal" defaultValue={(item.minimum_payment_minor / 100).toFixed(2)} required /></label><label>Due day<input name="due_day" type="number" min="1" max="31" defaultValue={item.due_day} required /></label><label>Next due<input name="next_date" type="date" defaultValue={item.next_due_date} required /></label><label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={item.is_active} /> Active schedule</label></div>
                      <button className="button primary" disabled={busy}>Save debt</button>
                    </form>
                    <div className="danger-zone"><b>Remove this debt</b><p>Upcoming only removes unlinked future minimum-payment obligations and stops this schedule. Delete all removes the debt and every generated minimum-payment obligation and payment link. Ledger transactions are always preserved.</p><div className="row-actions"><button className="button" disabled={busy} onClick={() => { if (window.confirm(`Remove upcoming minimum-payment obligations for ${item.name} and stop this schedule? Linked payment history will remain.`)) void act(`/v1/obligations/debts/${item.debt_id}?scope=upcoming`, { method: "DELETE" }, "Upcoming debt minimums removed and the debt schedule deactivated; linked history was preserved."); }}>Remove upcoming only</button><button className="button danger" disabled={busy} onClick={() => { if (window.confirm(`Permanently delete ${item.name}, all generated minimum-payment history, and payment links? Ledger transactions will remain.`)) void act(`/v1/obligations/debts/${item.debt_id}?scope=all`, { method: "DELETE" }, "Debt and all of its minimum-payment history deleted; ledger transactions were preserved."); }}>Delete debt and all</button></div></div>
                  </div>}
                </details>
              ))
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
