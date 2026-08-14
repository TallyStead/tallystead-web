"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAppSession } from "../../../components/app-shell";
import SplitEditor, { SplitDraft } from "../../../components/split-editor";
import RecurringProfileBuilder from "../../../components/recurring-profile-builder";
import { EmptyState, Notice, Panel, Pill } from "../../../components/ui";
import { apiRequest } from "../../../lib/client";
import {
  Account,
  BalanceExplanation,
  Category,
  Merchant,
  minorUnits,
  money,
  today,
  Transaction,
  TransactionDetail,
} from "../../../lib/ledger";

type Submit = <T>(
  path: string,
  init: RequestInit,
  message: string,
) => Promise<T | null>;
type LedgerTab = "activity" | "add" | "accounts" | "organization";

function AddTransaction({
  accounts,
  categories,
  merchants,
  busy,
  submit,
  refresh,
}: {
  accounts: Account[];
  categories: Category[];
  merchants: Merchant[];
  busy: boolean;
  submit: Submit;
  refresh: () => Promise<void>;
}) {
  const [direction, setDirection] = useState<"outflow" | "inflow">("outflow");
  const [amount, setAmount] = useState("");
  const [splits, setSplits] = useState<SplitDraft[]>([
    { key: 1, category_id: "", amount: "" },
  ]);
  const total = minorUnits(amount);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!total || total < 0) return;
    const filled = splits.filter((item) => item.category_id || item.amount);
    const allocated = filled.reduce(
      (sum, item) => sum + (minorUnits(item.amount) ?? 0),
      0,
    );
    if (
      filled.length &&
      (filled.some((item) => !item.category_id || !minorUnits(item.amount)) ||
        allocated !== total)
    )
      return;
    const account = accounts.find(
      (item) => item.account_id === data.get("account_id"),
    );
    if (!account) return;
    const sign = direction === "outflow" ? -1 : 1;
    const result = await submit<Transaction>(
      "/v1/ledger/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          account_id: account.account_id,
          transaction_date: data.get("transaction_date"),
          amount_minor: sign * total,
          currency_code: account.currency_code,
          status: data.get("status"),
          activity_type: data.get("activity_type"),
          payee: data.get("payee") || null,
          merchant_id: data.get("merchant_id") || null,
          memo: data.get("memo") || null,
          splits: filled.map((item) => ({
            category_id: item.category_id,
            amount_minor: sign * (minorUnits(item.amount) ?? 0),
          })),
        }),
      },
      "Transaction recorded with its source and allocation history.",
    );
    if (result) {
      form.reset();
      setAmount("");
      setSplits([{ key: Date.now(), category_id: "", amount: "" }]);
      await refresh();
    }
  }
  const allocationInvalid =
    splits.some((item) => item.category_id || item.amount) &&
    splits.reduce((sum, item) => sum + (minorUnits(item.amount) ?? 0), 0) !==
      (total ?? -1);
  return (
    <Panel span={7}>
      <p className="eyebrow">Manual entry</p>
      <h2>Add transaction</h2>
      {accounts.filter((item) => !item.is_archived).length === 0 ? (
        <p className="empty-inline">
          Create an account before adding a transaction.
        </p>
      ) : (
        <form onSubmit={save}>
          <div className="form-grid">
            <label>
              Account
              <select name="account_id" required>
                {accounts
                  .filter((item) => !item.is_archived)
                  .map((item) => (
                    <option key={item.account_id} value={item.account_id}>
                      {item.name} · {item.currency_code}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Date
              <input
                name="transaction_date"
                type="date"
                required
                defaultValue={today()}
              />
            </label>
            <label>
              Direction
              <select
                value={direction}
                onChange={(event) => {
                  setDirection(event.target.value as "outflow" | "inflow");
                  setSplits([{ key: Date.now(), category_id: "", amount: "" }]);
                }}
              >
                <option value="outflow">Money out</option>
                <option value="inflow">Money in</option>
              </select>
            </label>
            <label>
              Amount
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </label>
            <label>
              Payee or payer
              <input name="payee" maxLength={200} />
            </label>
            <label>
              Merchant
              <select name="merchant_id">
                <option value="">No normalized merchant</option>
                {merchants
                  .filter((item) => !item.is_archived)
                  .map((item) => (
                    <option key={item.merchant_id} value={item.merchant_id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Status
              <select name="status">
                <option value="posted">Posted</option>
                <option value="pending">Pending</option>
              </select>
            </label>
            <label>
              Activity
              <select name="activity_type" defaultValue="regular">
                <option value="regular">Regular transaction</option>
                <option value="contribution">Contribution</option>
                <option value="employer_match">Employer match</option>
                <option value="purchase">Investment purchase</option>
                <option value="sale">Investment sale</option>
                <option value="dividend">Dividend</option>
                <option value="interest">Interest</option>
                <option value="fee">Fee</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="market_adjustment">Market adjustment</option>
              </select>
            </label>
            <label>
              Memo
              <input name="memo" maxLength={2000} />
            </label>
          </div>
          <SplitEditor
            categories={categories}
            direction={direction}
            totalMinor={total}
            splits={splits}
            setSplits={setSplits}
          />
          <button
            className="button primary"
            disabled={busy || !total || allocationInvalid}
          >
            Add transaction
          </button>
        </form>
      )}
    </Panel>
  );
}

function TransferForm({
  accounts,
  busy,
  submit,
  refresh,
}: {
  accounts: Account[];
  busy: boolean;
  submit: Submit;
  refresh: () => Promise<void>;
}) {
  const active = accounts.filter((item) => !item.is_archived);
  const [sourceId, setSourceId] = useState("");
  const source =
    active.find((item) => item.account_id === sourceId) ?? active[0];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = minorUnits(data.get("amount")?.toString() ?? "");
    if (!amount || amount < 0 || !source) return;
    const result = await submit(
      "/v1/ledger/transfers",
      {
        method: "POST",
        body: JSON.stringify({
          from_account_id: source.account_id,
          to_account_id: data.get("to_account_id"),
          transaction_date: data.get("transaction_date"),
          amount_minor: amount,
          currency_code: source.currency_code,
          status: data.get("status"),
          memo: data.get("memo") || null,
        }),
      },
      "Transfer recorded as two linked, household-neutral ledger legs.",
    );
    if (result) {
      form.reset();
      await refresh();
    }
  }
  const destinations = active.filter(
    (item) =>
      item.account_id !== source?.account_id &&
      item.currency_code === source?.currency_code,
  );
  return (
    <Panel span={5}>
      <p className="eyebrow">Between accounts</p>
      <h2>Record transfer</h2>
      {active.length < 2 ? (
        <p className="empty-inline">
          Create two active accounts in the same currency to record a transfer.
        </p>
      ) : (
        <form onSubmit={save}>
          <label>
            From account
            <select
              name="from_account_id"
              value={source?.account_id ?? ""}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {active.map((item) => (
                <option key={item.account_id} value={item.account_id}>
                  {item.name} · {item.currency_code}
                </option>
              ))}
            </select>
          </label>
          <label>
            To account
            <select name="to_account_id" required>
              {destinations.map((item) => (
                <option key={item.account_id} value={item.account_id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Date
              <input
                type="date"
                name="transaction_date"
                defaultValue={today()}
                required
              />
            </label>
            <label>
              Amount
              <input
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </label>
            <label>
              Status
              <select name="status">
                <option value="posted">Posted</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>
          <label>
            Memo
            <input name="memo" maxLength={2000} />
          </label>
          <button
            className="button primary"
            disabled={busy || destinations.length === 0}
          >
            Record transfer
          </button>
        </form>
      )}
    </Panel>
  );
}

function TransactionDetailPanel({
  detail,
  accounts,
  categories,
  merchants,
  canWrite,
  busy,
  submit,
  refresh,
  close,
}: {
  detail: TransactionDetail;
  accounts: Account[];
  categories: Category[];
  merchants: Merchant[];
  canWrite: boolean;
  busy: boolean;
  submit: Submit;
  refresh: () => Promise<void>;
  close: () => void;
}) {
  const item = detail.transaction;
  const direction = item.amount_minor < 0 ? "outflow" : "inflow";
  const [splits, setSplits] = useState<SplitDraft[]>(
    item.splits.length
      ? item.splits.map((split, index) => ({
          key: index + 1,
          category_id: split.category_id,
          amount: (Math.abs(split.amount_minor) / 100).toFixed(2),
        }))
      : [{ key: 1, category_id: "", amount: "" }],
  );
  const [correctionAmount, setCorrectionAmount] = useState(
    (Math.abs(item.amount_minor) / 100).toFixed(2),
  );
  const [correctionSplits, setCorrectionSplits] = useState<SplitDraft[]>(
    item.splits.length
      ? item.splits.map((split, index) => ({
          key: index + 1000,
          category_id: split.category_id,
          amount: (Math.abs(split.amount_minor) / 100).toFixed(2),
        }))
      : [{ key: 1000, category_id: "", amount: "" }],
  );
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const absolute = Math.abs(item.amount_minor);
    const filled = splits.filter((split) => split.category_id || split.amount);
    const allocated = filled.reduce(
      (sum, split) => sum + (minorUnits(split.amount) ?? 0),
      0,
    );
    if (filled.length && allocated !== absolute) return;
    const sign = item.amount_minor < 0 ? -1 : 1;
    const result = await submit(
      `/v1/ledger/transactions/${item.transaction_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          payee: data.get("payee") || null,
          merchant_id: data.get("merchant_id") || null,
          memo: data.get("memo") || null,
          reason: data.get("reason"),
          splits: filled.map((split) => ({
            category_id: split.category_id,
            amount_minor: sign * (minorUnits(split.amount) ?? 0),
          })),
        }),
      },
      "Transaction corrected; the previous values remain in revision history.",
    );
    if (result) await refresh();
  }
  async function lifecycle(path: string, body: object, message: string) {
    const result = await submit(
      path,
      {
        method: path.endsWith("reconciliation") ? "PUT" : "POST",
        body: JSON.stringify(body),
      },
      message,
    );
    if (result) await refresh();
  }
  async function pendingStatus(status: "posted" | "voided") {
    const result = await submit(
      `/v1/ledger/transactions/${item.transaction_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reason:
            status === "posted"
              ? "Pending transaction posted"
              : "Pending transaction voided",
        }),
      },
      `Transaction ${status}.`,
    );
    if (result) await refresh();
  }
  async function correctEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const absolute = minorUnits(correctionAmount);
    if (!absolute || absolute < 0) return;
    const account = accounts.find(
      (candidate) => candidate.account_id === data.get("account_id"),
    );
    if (!account) return;
    const filled = correctionSplits.filter(
      (split) => split.category_id || split.amount,
    );
    const allocated = filled.reduce(
      (sum, split) => sum + (minorUnits(split.amount) ?? 0),
      0,
    );
    if (filled.length && allocated !== absolute) return;
    const sign = item.amount_minor < 0 ? -1 : 1;
    const result = await submit<Transaction>(
      `/v1/ledger/transactions/${item.transaction_id}/correct`,
      {
        method: "POST",
        body: JSON.stringify({
          account_id: account.account_id,
          transaction_date: data.get("transaction_date"),
          amount_minor: sign * absolute,
          currency_code: account.currency_code,
          status: "posted",
          payee: data.get("payee") || null,
          merchant_id: data.get("merchant_id") || null,
          memo: data.get("memo") || null,
          reason: data.get("reason"),
          splits: filled.map((split) => ({
            category_id: split.category_id,
            amount_minor: sign * (minorUnits(split.amount) ?? 0),
          })),
        }),
      },
      "Correction recorded as an opposite event and a replacement; the original evidence remains available.",
    );
    if (result) await refresh();
  }
  return (
    <Panel span={12} className="transaction-detail">
      <div className="title-with-status">
        <div>
          <p className="eyebrow">Transaction detail</p>
          <h2>{item.payee || item.merchant_name || "Untitled transaction"}</h2>
        </div>
        <div className="row-actions">
          <Pill
            tone={
              item.status === "voided"
                ? "red"
                : item.status === "pending"
                  ? "amber"
                  : "blue"
            }
          >
            {item.status}
          </Pill>
          {item.reconciled_at && <Pill>Reconciled</Pill>}
          <button className="button compact" onClick={close}>
            Close
          </button>
        </div>
      </div>
      <div className="detail-facts">
        <span>
          <b>{money(item.amount_minor, item.currency_code)}</b>
          <small>{item.account_name}</small>
        </span>
        <span>
          <b>
            {new Date(`${item.transaction_date}T12:00:00`).toLocaleDateString()}
          </b>
          <small>Transaction date</small>
        </span>
        <span>
          <b>{item.merchant_name || "Not normalized"}</b>
          <small>Merchant</small>
        </span>
        <span>
          <b>{item.raw_payee || "Manual entry"}</b>
          <small>Original payee evidence</small>
        </span>
        <span>
          <b>{item.activity_type.replaceAll("_", " ")}</b>
          <small>{item.source_type} source</small>
        </span>
      </div>
      <div className="grid detail-grid">
        <section className="span-7">
          <h3>Allocation</h3>
          {item.splits.length ? (
            item.splits.map((split) => (
              <div className="row" key={split.split_id}>
                <span>{split.category_name}</span>
                <b>{money(split.amount_minor, item.currency_code)}</b>
              </div>
            ))
          ) : (
            <p className="empty-inline">Uncategorized</p>
          )}
          {canWrite &&
            !item.reconciled_at &&
            !["voided", "reversed"].includes(item.status) && (
              <details className="ledger-tool">
                <summary>Correct details or splits</summary>
                <form onSubmit={edit}>
                  <div className="form-grid">
                    <label>
                      Displayed payee
                      <input name="payee" defaultValue={item.payee ?? ""} />
                    </label>
                    <label>
                      Merchant
                      <select
                        name="merchant_id"
                        defaultValue={item.merchant_id ?? ""}
                      >
                        <option value="">No normalized merchant</option>
                        {merchants
                          .filter((merchant) => !merchant.is_archived)
                          .map((merchant) => (
                            <option
                              key={merchant.merchant_id}
                              value={merchant.merchant_id}
                            >
                              {merchant.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="full-field">
                      Memo
                      <input name="memo" defaultValue={item.memo ?? ""} />
                    </label>
                    <label className="full-field">
                      Reason for correction
                      <input name="reason" required minLength={3} />
                    </label>
                  </div>
                  <SplitEditor
                    categories={categories}
                    direction={direction}
                    totalMinor={Math.abs(item.amount_minor)}
                    splits={splits}
                    setSplits={setSplits}
                  />
                  <button className="button primary" disabled={busy}>
                    Save audited correction
                  </button>
                </form>
              </details>
            )}
          {canWrite && item.status === "posted" && !item.reconciled_at && (
            <details className="ledger-tool">
              <summary>Correct amount, account, or date</summary>
              <form onSubmit={correctEvent}>
                <div className="form-grid">
                  <label>
                    Account
                    <select name="account_id" defaultValue={item.account_id}>
                      {accounts
                        .filter(
                          (account) =>
                            !account.is_archived &&
                            account.currency_code === item.currency_code,
                        )
                        .map((account) => (
                          <option
                            key={account.account_id}
                            value={account.account_id}
                          >
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      name="transaction_date"
                      defaultValue={item.transaction_date}
                      required
                    />
                  </label>
                  <label>
                    Amount
                    <input
                      value={correctionAmount}
                      onChange={(event) =>
                        setCorrectionAmount(event.target.value)
                      }
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label>
                    Payee or payer
                    <input name="payee" defaultValue={item.payee ?? ""} />
                  </label>
                  <label>
                    Merchant
                    <select
                      name="merchant_id"
                      defaultValue={item.merchant_id ?? ""}
                    >
                      <option value="">No normalized merchant</option>
                      {merchants
                        .filter((merchant) => !merchant.is_archived)
                        .map((merchant) => (
                          <option
                            key={merchant.merchant_id}
                            value={merchant.merchant_id}
                          >
                            {merchant.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Memo
                    <input name="memo" defaultValue={item.memo ?? ""} />
                  </label>
                  <label className="full-field">
                    Reason for replacement
                    <input name="reason" minLength={3} required />
                  </label>
                </div>
                <SplitEditor
                  categories={categories}
                  direction={direction}
                  totalMinor={minorUnits(correctionAmount)}
                  splits={correctionSplits}
                  setSplits={setCorrectionSplits}
                />
                <button className="button primary" disabled={busy}>
                  Reverse and replace
                </button>
              </form>
            </details>
          )}
        </section>
        <section className="span-5">
          <h3>Lifecycle actions</h3>
          {item.status === "posted" && !item.transfer_id && (
            <RecurringProfileBuilder transactionId={item.transaction_id} onChanged={refresh} />
          )}
          {canWrite && item.status === "pending" && (
            <div className="row-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => pendingStatus("posted")}
              >
                Mark posted
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => pendingStatus("voided")}
              >
                Void pending
              </button>
            </div>
          )}
          {canWrite && ["posted", "reversed"].includes(item.status) && (
            <button
              className="button full-width"
              disabled={busy}
              onClick={() =>
                lifecycle(
                  `/v1/ledger/transactions/${item.transaction_id}/reconciliation`,
                  { reconciled: !item.reconciled_at },
                  item.reconciled_at
                    ? "Transaction returned to unreconciled."
                    : "Transaction reconciled.",
                )
              }
            >
              {item.reconciled_at ? "Unreconcile" : "Mark reconciled"}
            </button>
          )}
          {canWrite && item.status === "posted" && !item.reconciled_at && (
            <details className="ledger-tool">
              <summary>Reverse this transaction</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void lifecycle(
                    `/v1/ledger/transactions/${item.transaction_id}/reverse`,
                    {
                      transaction_date: data.get("transaction_date"),
                      reason: data.get("reason"),
                    },
                    "Reversal created; the original evidence was retained.",
                  );
                }}
              >
                <label>
                  Reversal date
                  <input
                    type="date"
                    name="transaction_date"
                    defaultValue={today()}
                    required
                  />
                </label>
                <label>
                  Reason
                  <input name="reason" minLength={3} required />
                </label>
                <button className="button" disabled={busy}>
                  Create reversal
                </button>
              </form>
            </details>
          )}
          <h3 className="top-space">Revision history</h3>
          {detail.revisions.length === 0 ? (
            <p className="empty-inline">No corrections yet.</p>
          ) : (
            detail.revisions.map((revision) => (
              <div className="revision" key={revision.revision_id}>
                <b>{revision.reason}</b>
                <small>{new Date(revision.created_at).toLocaleString()}</small>
              </div>
            ))
          )}
        </section>
      </div>
    </Panel>
  );
}

export default function TransactionsPage() {
  const { serverUrl, session, me } = useAppSession();
  const canWrite = me.role === "owner" || me.role === "manager";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [balance, setBalance] = useState<BalanceExplanation | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<LedgerTab>("activity");
  const load = useCallback(async () => {
    const [a, c, m, t] = await Promise.all([
      apiRequest<Account[]>(
        serverUrl,
        "/v1/ledger/accounts",
        {},
        session.access_token,
      ),
      apiRequest<Category[]>(
        serverUrl,
        "/v1/ledger/categories",
        {},
        session.access_token,
      ),
      apiRequest<Merchant[]>(
        serverUrl,
        "/v1/ledger/merchants",
        {},
        session.access_token,
      ),
      apiRequest<Transaction[]>(
        serverUrl,
        "/v1/ledger/transactions",
        {},
        session.access_token,
      ),
    ]);
    setAccounts(a);
    setCategories(c);
    setMerchants(m);
    setTransactions(t);
  }, [serverUrl, session.access_token]);
  useEffect(() => {
    void load().catch((error: Error) => setNotice(error.message));
  }, [load]);
  const submit: Submit = async <T,>(
    path: string,
    init: RequestInit,
    message: string,
  ) => {
    setBusy(true);
    setNotice("");
    try {
      const result = await apiRequest<T>(
        serverUrl,
        path,
        init,
        session.access_token,
      );
      setNotice(message);
      return result;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The ledger could not complete that action.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  async function refresh() {
    await load();
    if (detail) {
      try {
        setDetail(
          await apiRequest<TransactionDetail>(
            serverUrl,
            `/v1/ledger/transactions/${detail.transaction.transaction_id}`,
            {},
            session.access_token,
          ),
        );
      } catch {
        setDetail(null);
      }
    }
  }
  async function selectTransaction(id: string) {
    setDetail(
      await apiRequest<TransactionDetail>(
        serverUrl,
        `/v1/ledger/transactions/${id}`,
        {},
        session.access_token,
      ),
    );
  }
  async function explain(
    account: Account,
    asOf = today(),
    includePending = true,
  ) {
    setBalance(
      await apiRequest<BalanceExplanation>(
        serverUrl,
        `/v1/ledger/accounts/${account.account_id}/balance?as_of=${asOf}&include_pending=${includePending}`,
        {},
        session.access_token,
      ),
    );
  }
  async function patchResource(path: string, body: object, message: string) {
    const result = await submit(
      path,
      { method: "PATCH", body: JSON.stringify(body) },
      message,
    );
    if (result) await refresh();
  }
  async function exportLedger() {
    setBusy(true);
    try {
      const response = await fetch(
        `${serverUrl.replace(/\/$/, "")}/v1/ledger/export`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (!response.ok) throw new Error("Ledger export could not be created.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tallystead-ledger-${today()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(
        "Private ledger export created. Authentication and integration secrets were excluded.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const opening = minorUnits(data.get("opening")?.toString() ?? "0");
    if (opening === null)
      return setNotice(
        "Enter an opening balance with no more than two decimal places.",
      );
    const result = await submit(
      "/v1/ledger/accounts",
      {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          account_type: data.get("account_type"),
          currency_code: data.get("currency_code"),
          opening_balance_minor: opening,
          institution: data.get("institution") || null,
          masked_identifier: data.get("masked_identifier") || null,
        }),
      },
      "Account created.",
    );
    if (result) {
      form.reset();
      await refresh();
    }
  }
  async function updateAccount(event: FormEvent<HTMLFormElement>, account: Account) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await patchResource(`/v1/ledger/accounts/${account.account_id}`, { name: data.get("name"), ownership_scope: data.get("ownership_scope"), balance_nature: data.get("balance_nature"), liquidity: data.get("liquidity"), tax_treatment: data.get("tax_treatment"), institution: data.get("institution") || null, masked_identifier: data.get("masked_identifier") || null, include_in_planner: data.has("include_in_planner"), include_in_net_worth: data.has("include_in_net_worth") }, "Account classification updated.");
  }
  async function addValuation(event: FormEvent<HTMLFormElement>, account: Account) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const value = minorUnits(data.get("value")?.toString() ?? ""); if (value === null || value < 0) return setNotice("Enter a non-negative valuation.");
    const result = await submit(`/v1/ledger/accounts/${account.account_id}/valuations`, { method: "POST", body: JSON.stringify({ valuation_date: data.get("valuation_date"), value_minor: value, currency_code: account.currency_code, source_type: "manual", note: data.get("note") || null }) }, "Account valuation recorded separately from ledger cash activity.");
    if (result) { form.reset(); await refresh(); }
  }
  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await submit(
      "/v1/ledger/categories",
      {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          category_type: data.get("category_type"),
        }),
      },
      "Category created.",
    );
    if (result) {
      form.reset();
      await refresh();
    }
  }
  async function addMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const aliases =
      data
        .get("aliases")
        ?.toString()
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? [];
    const result = await submit(
      "/v1/ledger/merchants",
      {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), aliases }),
      },
      "Merchant created without changing any raw payee evidence.",
    );
    if (result) {
      form.reset();
      await refresh();
    }
  }

  return (
    <div className="ledger-page">
      {notice && <Notice title="Ledger update">{notice}</Notice>}
      <div className="ledger-toolbar">
        <div>
          <b>Household ledger</b>
          <small>
            Balances replay from opening values and included ledger events.
          </small>
        </div>
        {canWrite && (
          <button className="button" disabled={busy} onClick={exportLedger}>
            Export ledger
          </button>
        )}
      </div>
      <nav className="ledger-tabs" aria-label="Transaction sections">
        {(
          [
            ["activity", "Activity"],
            ["add", "Add money movement"],
            ["accounts", "Accounts"],
            ["organization", "Categories & merchants"],
          ] as const
        ).map(([id, label]) =>
          canWrite || id === "activity" ? (
            <button
              key={id}
              className={activeTab === id ? "active" : ""}
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => {
                setActiveTab(id);
                if (id !== "activity") setDetail(null);
              }}
            >
              {label}
            </button>
          ) : null,
        )}
      </nav>
      {activeTab === "activity" && detail && (
        <div className="grid">
          <TransactionDetailPanel
            detail={detail}
            accounts={accounts}
            categories={categories}
            merchants={merchants}
            canWrite={canWrite}
            busy={busy}
            submit={submit}
            refresh={refresh}
            close={() => setDetail(null)}
          />
        </div>
      )}
      {activeTab === "activity" && (
        <div className="grid">
          <Panel span={8}>
            <div className="title-with-status">
              <div>
                <p className="eyebrow">Observed money movement</p>
                <h2>Transactions</h2>
              </div>
              <Pill tone="blue">{transactions.length} recorded</Pill>
            </div>
            {transactions.length === 0 ? (
              <EmptyState title="No transactions yet">
                Create an account, then record the household’s first transaction
                or transfer.
              </EmptyState>
            ) : (
              <div className="transaction-list">
                {transactions.map((item) => (
                  <button
                    className="transaction-row transaction-button"
                    key={item.transaction_id}
                    onClick={() => selectTransaction(item.transaction_id)}
                  >
                    <div>
                      <b>
                        {item.payee ||
                          item.merchant_name ||
                          (item.transfer_id
                            ? "Account transfer"
                            : "Untitled transaction")}
                      </b>
                      <small>
                        {new Date(
                          `${item.transaction_date}T12:00:00`,
                        ).toLocaleDateString()}{" "}
                        · {item.account_name} ·{" "}
                        {item.splits
                          .map((split) => split.category_name)
                          .join(", ") || item.source_type}
                      </small>
                    </div>
                    <div
                      className={
                        item.amount_minor < 0
                          ? "transaction-amount outflow"
                          : "transaction-amount inflow"
                      }
                    >
                      {money(item.amount_minor, item.currency_code)}
                      <small>
                        {item.status}
                        {item.reconciled_at ? " · reconciled" : ""}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
          <Panel span={4}>
            <p className="eyebrow">Explainable balances</p>
            <h2>Accounts</h2>
            {accounts.length === 0 ? (
              <p className="empty-inline">No financial accounts yet.</p>
            ) : (
              accounts.map((account) => (
                <button
                  className="row account-button"
                  key={account.account_id}
                  onClick={() => explain(account)}
                >
                  <span>
                    <b>{account.name}</b>
                    <small>
                      {account.account_type.replace("_", " ")} ·{" "}
                      {account.currency_code}
                      {account.is_archived ? " · archived" : ""}
                    </small>
                  </span>
                  <b>{money(account.balance_minor, account.currency_code)}</b>
                </button>
              ))
            )}
            {balance && (
              <div className="balance-proof">
                <div className="title-with-status">
                  <b>{balance.account_name} basis</b>
                  <button
                    className="button compact"
                    onClick={() => setBalance(null)}
                  >
                    Close
                  </button>
                </div>
                <p>
                  <span>Opening balance</span>
                  <b>
                    {money(
                      balance.opening_balance_minor,
                      balance.currency_code,
                    )}
                  </b>
                </p>
                <p>
                  <span>Included activity</span>
                  <b>{money(balance.activity_minor, balance.currency_code)}</b>
                </p>
                <p>
                  <span>Balance as of {balance.as_of}</span>
                  <b>{money(balance.balance_minor, balance.currency_code)}</b>
                </p>
                <small>
                  {balance.included_transaction_ids.length} included events ·
                  pending included
                </small>
              </div>
            )}
          </Panel>
        </div>
      )}
      {canWrite && activeTab === "add" && (
        <div className="grid ledger-entry-grid">
          <AddTransaction
            accounts={accounts}
            categories={categories}
            merchants={merchants}
            busy={busy}
            submit={submit}
            refresh={refresh}
          />
          <TransferForm
            accounts={accounts}
            busy={busy}
            submit={submit}
            refresh={refresh}
          />
        </div>
      )}
      {canWrite &&
        (activeTab === "accounts" || activeTab === "organization") && (
          <div className={`grid management-grid management-${activeTab}`}>
            <Panel span={4}>
              <p className="eyebrow">Account management</p>
              <h2>Accounts</h2>
              <form onSubmit={addAccount}>
                <label>
                  Name
                  <input
                    name="name"
                    required
                    placeholder="Household checking"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Type
                    <select name="account_type">
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="cash">Cash</option>
                      <option value="money_market">Money market</option>
                      <option value="credit_card">Credit card</option>
                      <option value="loan">Loan</option>
                      <option value="mortgage">Mortgage</option>
                      <option value="line_of_credit">Line of credit</option>
                      <option value="brokerage">Brokerage</option>
                      <option value="investment">Other investment</option>
                      <option value="401k">401(k)</option>
                      <option value="403b">403(b)</option>
                      <option value="traditional_ira">Traditional IRA</option>
                      <option value="roth_ira">Roth IRA</option>
                      <option value="pension">Pension</option>
                      <option value="hsa">HSA</option>
                      <option value="fsa">FSA</option>
                      <option value="property">Property</option>
                      <option value="vehicle">Vehicle</option>
                      <option value="business_checking">Business checking</option>
                      <option value="business_savings">Business savings</option>
                      <option value="business_credit_card">Business credit card</option>
                      <option value="business_loan">Business loan</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Currency
                    <select name="currency_code">
                      <option>USD</option>
                      <option>CAD</option>
                      <option>MXN</option>
                    </select>
                  </label>
                </div>
                <label>
                  Opening balance
                  <input
                    name="opening"
                    defaultValue="0.00"
                    inputMode="decimal"
                  />
                </label>
                <div className="form-grid"><label>Institution<input name="institution" placeholder="Optional" /></label><label>Last four / label<input name="masked_identifier" maxLength={24} placeholder="•••• 1234" /></label></div>
                <p className="field-help">Planner, ownership, liquidity, and tax defaults are chosen safely from the account type and can be adjusted below.</p>
                <button className="button primary" disabled={busy}>
                  Create account
                </button>
              </form>
              {accounts.map((account) => (
                <details className="obligation-card account-management-card" key={account.account_id}>
                  <summary><span><b>{account.name}</b><small>{account.account_type.replaceAll("_", " ")} · {account.ownership_scope} · {account.liquidity}{account.is_archived ? " · archived" : ""}</small></span><b>{money(account.current_value_minor, account.currency_code)}</b></summary>
                  <div className="profile-management">
                    <form onSubmit={(event) => updateAccount(event, account)}>
                      <div className="form-grid"><label>Name<input name="name" defaultValue={account.name} required /></label><label>Ownership<select name="ownership_scope" defaultValue={account.ownership_scope}><option value="household">Household</option><option value="business">Business</option></select></label><label>Nature<select name="balance_nature" defaultValue={account.balance_nature}><option value="asset">Asset</option><option value="liability">Liability</option></select></label><label>Liquidity<select name="liquidity" defaultValue={account.liquidity}><option value="spendable">Spendable</option><option value="restricted">Restricted purpose</option><option value="invested">Invested</option><option value="non_liquid">Non-liquid</option><option value="liability">Liability</option></select></label><label>Tax treatment<select name="tax_treatment" defaultValue={account.tax_treatment}><option value="none">None</option><option value="taxable">Taxable</option><option value="tax_deferred">Tax deferred</option><option value="tax_free">Tax free</option><option value="health_advantaged">Health advantaged</option></select></label><label>Institution<input name="institution" defaultValue={account.institution ?? ""} /></label><label>Last four / label<input name="masked_identifier" defaultValue={account.masked_identifier ?? ""} /></label></div>
                      <div className="row-actions profile-checks"><label className="checkbox-line"><input type="checkbox" name="include_in_planner" defaultChecked={account.include_in_planner} /> Cash Planner</label><label className="checkbox-line"><input type="checkbox" name="include_in_net_worth" defaultChecked={account.include_in_net_worth} /> Net worth</label></div>
                      <button className="button primary" disabled={busy}>Save classification</button>
                    </form>
                    <form className="valuation-form" onSubmit={(event) => addValuation(event, account)}><b>Record market or statement value</b><small>Use this for investments, retirement, HSA/FSA, property, vehicles, and other valued accounts. It does not create a transaction.</small><div className="form-grid"><label>Date<input type="date" name="valuation_date" defaultValue={today()} required /></label><label>Value<input name="value" inputMode="decimal" required /></label><label className="full-field">Note<input name="note" placeholder="Statement or valuation source" /></label></div><button className="button" disabled={busy}>Record valuation</button></form>
                    <div className="row-actions"><button className="button compact" onClick={() => patchResource(`/v1/ledger/accounts/${account.account_id}`, { is_archived: !account.is_archived }, account.is_archived ? "Account restored." : "Account archived; history remains intact.")}>{account.is_archived ? "Restore" : "Archive"}</button></div>
                  </div>
                </details>
              ))}
            </Panel>
            <Panel span={4}>
              <p className="eyebrow">Household intent</p>
              <h2>Categories</h2>
              <form onSubmit={addCategory}>
                <label>
                  Name
                  <input name="name" required placeholder="Pet care" />
                </label>
                <label>
                  Type
                  <select name="category_type">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <button className="button primary" disabled={busy}>
                  Create category
                </button>
              </form>
              <div className="management-list">
                {categories.map((category) => (
                  <div className="row" key={category.category_id}>
                    <span>
                      <b>{category.name}</b>
                      <small>
                        {category.category_type}
                        {category.is_system_default
                          ? " · default"
                          : " · custom"}
                      </small>
                    </span>
                    <button
                      className="button compact"
                      onClick={() =>
                        patchResource(
                          `/v1/ledger/categories/${category.category_id}`,
                          { is_archived: !category.is_archived },
                          category.is_archived
                            ? "Category restored."
                            : "Category archived; existing allocations remain visible.",
                        )
                      }
                    >
                      {category.is_archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel span={4}>
              <p className="eyebrow">Normalized counterparties</p>
              <h2>Merchants</h2>
              <form onSubmit={addMerchant}>
                <label>
                  Name
                  <input
                    name="name"
                    required
                    placeholder="Neighborhood Market"
                  />
                </label>
                <label>
                  Aliases
                  <input name="aliases" placeholder="MARKET #42, MARKET WEST" />
                  <small>Comma-separated raw names</small>
                </label>
                <button className="button primary" disabled={busy}>
                  Create merchant
                </button>
              </form>
              {merchants.length === 0 ? (
                <p className="empty-inline top-space">
                  No normalized merchants yet. Raw payee text is still retained.
                </p>
              ) : (
                <div className="management-list">
                  {merchants.map((merchant) => (
                    <div className="row" key={merchant.merchant_id}>
                      <span>
                        <b>{merchant.name}</b>
                        <small>{merchant.aliases.length} aliases</small>
                      </span>
                      <button
                        className="button compact"
                        onClick={() =>
                          patchResource(
                            `/v1/ledger/merchants/${merchant.merchant_id}`,
                            { is_archived: !merchant.is_archived },
                            merchant.is_archived
                              ? "Merchant restored."
                              : "Merchant archived.",
                          )
                        }
                      >
                        {merchant.is_archived ? "Restore" : "Archive"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}
      {!canWrite && (
        <Notice title="Read-only ledger">
          Your household role can inspect shared balances, transactions, and
          their evidence. An Owner or Manager records changes.
        </Notice>
      )}
    </div>
  );
}
