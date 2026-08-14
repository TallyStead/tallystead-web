"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAppSession } from "./app-shell";
import { apiRequest } from "../lib/client";
import { AutomationPreferences } from "../lib/imports";

export default function AutomationPreferencesPanel({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const { serverUrl, session, me } = useAppSession();
  const canWrite = me.role === "owner" || me.role === "manager";
  const [value, setValue] = useState<AutomationPreferences | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiRequest<AutomationPreferences>(serverUrl, "/v1/automation/preferences", {}, session.access_token)
      .then(setValue)
      .catch((error: Error) => setNotice(error.message));
  }, [serverUrl, session.access_token]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setNotice("");
    try {
      const updated = await apiRequest<AutomationPreferences>(serverUrl, "/v1/automation/preferences", { method: "PUT", body: JSON.stringify({ transfer_window_days: Number(data.get("transfer")), reimbursement_window_days: Number(data.get("reimbursement")) }) }, session.access_token);
      setValue(updated);
      setNotice("Matching windows saved. Pending previews were recalculated.");
      await onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Preferences could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!value) return <p className="muted">Loading matching preferences…</p>;
  return <form className="form-grid one-column" onSubmit={save}><label>Transfer posting window<input name="transfer" type="number" min="1" max="14" defaultValue={value.transfer_window_days}/><small>Days before or after the imported posting date.</small></label><label>Refund search window<input name="reimbursement" type="number" min="7" max="730" defaultValue={value.reimbursement_window_days}/><small>How far back to search for original expenses.</small></label><button className="button primary" disabled={busy||!canWrite}>Save matching windows</button>{notice&&<small>{notice}</small>}</form>;
}
