"use client";

import { useState } from "react";
import { useAppSession } from "./app-shell";
import { apiRequest } from "../lib/client";
import { RecurringCandidate } from "../lib/imports";
import { money } from "../lib/ledger";

export default function RecurringProfileBuilder({
  transactionId,
  onChanged,
}: {
  transactionId: string;
  onChanged?: () => void | Promise<void>;
}) {
  const { serverUrl, session, me } = useAppSession();
  const canWrite = me.role === "owner" || me.role === "manager";
  const [proposal, setProposal] = useState<RecurringCandidate | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function inspect() {
    setBusy(true);
    setNotice("");
    try {
      const value = await apiRequest<RecurringCandidate>(
        serverUrl,
        `/v1/automation/recurring/${transactionId}/proposal`,
        {},
        session.access_token,
      );
      setProposal(value);
      setSelected(new Set(value.transaction_ids));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pattern could not be inspected.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!proposal) return;
    setBusy(true);
    setNotice("");
    try {
      await apiRequest(
        serverUrl,
        "/v1/automation/recurring",
        {
          method: "POST",
          body: JSON.stringify({
            transaction_id: transactionId,
            transaction_ids: [...selected],
          }),
        },
        session.access_token,
      );
      setNotice(`${proposal.profile_type === "bill" ? "Bill" : "Income"} profile created.`);
      setProposal(null);
      await onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Profile could not be created.");
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) {
    return (
      <div className="recurring-builder">
        <button className="button compact" disabled={busy} onClick={() => void inspect()}>
          Find recurring pattern
        </button>
        {notice && <small>{notice}</small>}
      </div>
    );
  }

  return (
    <div className="recurring-builder">
      <div className="title-with-status">
        <div>
          <b>{proposal.name}</b>
          <small>
            {proposal.cadence} · expected {money(proposal.expected_amount_minor, proposal.currency_code)} · next {proposal.next_expected_date}
          </small>
        </div>
        <button className="button compact" onClick={() => setProposal(null)}>Cancel</button>
      </div>
      <p className="muted">Choose the history that belongs to this profile. At least three transactions are required for a detected pattern.</p>
      <div className="recurring-history">
        {proposal.transactions.map((item) => (
          <label className="checkbox-line" key={item.transaction_id}>
            <input
              type="checkbox"
              checked={selected.has(item.transaction_id)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(item.transaction_id);
                else next.delete(item.transaction_id);
                setSelected(next);
              }}
            />
            {item.transaction_date} · {item.payee || "Transaction"} · {money(item.amount_minor, proposal.currency_code)}
          </label>
        ))}
      </div>
      <button className="button compact primary" disabled={busy || !canWrite || selected.size < 3} onClick={() => void create()}>
        Create {proposal.profile_type} from {selected.size} selected
      </button>
      {notice && <small>{notice}</small>}
    </div>
  );
}
