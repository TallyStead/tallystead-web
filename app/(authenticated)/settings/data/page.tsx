"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppSession } from "../../../../components/app-shell";
import { Notice, Panel, Pill } from "../../../../components/ui";
import { apiRequest } from "../../../../lib/client";

type DataStatus = {
  mode: "standard" | "demo";
  demo_seed: string;
  demo_reference_date: string | null;
  demo_volume: string | null;
  household_name: string;
  record_count: number;
  document_count: number;
  transaction_count: number;
  can_create_demo: boolean;
  delete_confirmation: string;
};

function archiveBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The archive could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function DataPage() {
  const { serverUrl, session, refreshIdentity } = useAppSession();
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState<File | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [demoConfirmation, setDemoConfirmation] = useState("");
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [demoVolume, setDemoVolume] = useState<"smoke" | "realistic">("realistic");

  const load = useCallback(async () => {
    setStatus(await apiRequest<DataStatus>(serverUrl, "/v1/data/status", {}, session.access_token));
  }, [serverUrl, session.access_token]);
  useEffect(() => { void load().catch((error) => setNotice(error instanceof Error ? error.message : "Data status could not be loaded.")); }, [load]);

  async function exportData() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`${serverUrl.replace(/\/$/, "")}/v1/data/export`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? "The archive could not be created."); }
      const disposition = response.headers.get("Content-Disposition") ?? "";
 const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `tallystead-household-${new Date().toISOString().slice(0, 10)}.tallystead.zip`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
      setNotice("Your complete household archive was downloaded locally.");
      await Promise.all([load(), refreshIdentity()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The archive could not be created."); }
    finally { setBusy(false); }
  }

  async function restoreData() {
    if (!archive) { setNotice("Choose a Tallystead archive first."); return; }
    setBusy(true); setNotice("");
    try {
      const encoded = await archiveBase64(archive);
      await apiRequest(serverUrl, "/v1/data/import", { method: "POST", body: JSON.stringify({ archive_base64: encoded, confirmation: restoreConfirmation }) }, session.access_token);
      setArchive(null); setRestoreConfirmation("");
      setNotice("The household archive was validated and restored. Your sign-in and server settings were preserved.");
      await Promise.all([load(), refreshIdentity()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The archive could not be restored."); }
    finally { setBusy(false); }
  }

  async function deleteData() {
    if (!status || !window.confirm("Permanently delete this household's financial records and stored documents? External backup archives are not deleted.")) return;
    setBusy(true); setNotice("");
    try {
      await apiRequest(serverUrl, "/v1/data/household", { method: "DELETE", body: JSON.stringify({ confirmation: deleteConfirmation }) }, session.access_token);
      setDeleteConfirmation(""); setNotice("Household financial data was deleted. Members, sign-in, and server settings remain available."); await Promise.all([load(), refreshIdentity()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Household data could not be deleted."); }
    finally { setBusy(false); }
  }

  async function demoAction(action: "create" | "reset" | "remove") {
    const expected = action === "create" ? "CREATE DEMO" : action === "reset" ? "RESET DEMO" : "REMOVE DEMO";
    if (demoConfirmation !== expected) { setNotice(`Type “${expected}” to continue.`); return; }
    if (action !== "create" && !window.confirm(`${action === "reset" ? "Reset" : "Remove"} the fictional demo data?`)) return;
    setBusy(true); setNotice("");
    try {
      const path = action === "create" ? "/v1/data/demo" : action === "reset" ? "/v1/data/demo/reset" : "/v1/data/demo";
      const method = action === "remove" ? "DELETE" : "POST";
      const body = action === "remove" ? { confirmation: expected } : { confirmation: expected, reference_date: referenceDate, volume: demoVolume };
      await apiRequest(serverUrl, path, { method, body: JSON.stringify(body) }, session.access_token);
      setDemoConfirmation(""); setNotice(action === "create" ? "The fictional demo household is ready." : action === "reset" ? "The demo was recreated from the same deterministic scenario." : "The fictional demo data was removed."); await Promise.all([load(), refreshIdentity()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The demo action could not be completed."); }
    finally { setBusy(false); }
  }

  return <div className="grid">
    {notice && <div className="span-12"><Notice title="Data management">{notice}</Notice></div>}
    <Panel span={7}>
      <p className="eyebrow">Portable local archive</p><h2>Export all household data</h2>
      <p className="muted">Downloads financial records, rules, plans, reports, conversations, import evidence, and original documents in one restorable archive.</p>
      <div className="row"><div><b>{status?.record_count.toLocaleString() ?? "—"} records</b><small>{status?.transaction_count.toLocaleString() ?? "—"} transactions · {status?.document_count.toLocaleString() ?? "—"} documents</small></div><Pill tone="blue">Local file</Pill></div>
      <Notice title="Intentionally excluded">Passwords, passkeys, active sessions, integration credentials, and server configuration stay with this installation.</Notice>
      <button className="button primary top-space" disabled={busy || !status} onClick={exportData}>Download complete archive</button>
    </Panel>
    <Panel span={5}>
      <p className="eyebrow">Validated replacement</p><h2>Restore from an archive</h2>
      <p className="muted">The archive must belong to this household. Its records replace current financial data after the file and document checks pass.</p>
 <label>Archive file<input type="file" accept=".zip,.tallystead.zip,application/zip" onChange={(event: ChangeEvent<HTMLInputElement>) => setArchive(event.target.files?.[0] ?? null)} /></label>
      <label>Type RESTORE MY DATA<input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} autoComplete="off" /></label>
      <button className="button primary" disabled={busy || !archive || restoreConfirmation !== "RESTORE MY DATA"} onClick={restoreData}>Validate and restore</button>
    </Panel>
    <Panel span={7} className={status?.mode === "demo" ? "profile-starter" : ""}>
      <p className="eyebrow">Phase 6C · clearly fictional</p><h2>Deterministic demo household</h2>
      <p className="muted">Creates a fixed local scenario with fictional accounts, transactions, transfers, reimbursements, bills, income, debts, import review work, a document, reports, and the seven-step plan.</p>
      <div className="row"><div><b>{status?.mode === "demo" ? "Demo data active" : "Standard household data"}</b><small>{status?.mode === "demo" ? `Reference date ${status.demo_reference_date}` : "Demo creation is available only when the household has no accounts."}</small></div><Pill tone={status?.mode === "demo" ? "amber" : "green"}>{status?.mode === "demo" ? "Fictional" : "Not demo"}</Pill></div>
      <label>Demo reference date<input type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} /></label>
      <label>Fixture size<select value={demoVolume} onChange={(event) => setDemoVolume(event.target.value as "smoke" | "realistic")}><option value="realistic">Realistic · nine months</option><option value="smoke">Smoke test · two months</option></select></label>
      <label>Confirmation phrase<input value={demoConfirmation} onChange={(event) => setDemoConfirmation(event.target.value)} placeholder={status?.mode === "demo" ? "RESET DEMO or REMOVE DEMO" : "CREATE DEMO"} autoComplete="off" /></label>
      <div className="row-actions">
        {status?.mode !== "demo" && <button className="button primary" disabled={busy || !status?.can_create_demo || demoConfirmation !== "CREATE DEMO"} onClick={() => demoAction("create")}>Create demo data</button>}
        {status?.mode === "demo" && <button className="button primary" disabled={busy || demoConfirmation !== "RESET DEMO"} onClick={() => demoAction("reset")}>Reset demo</button>}
        {status?.mode === "demo" && <button className="button danger" disabled={busy || demoConfirmation !== "REMOVE DEMO"} onClick={() => demoAction("remove")}>Remove demo</button>}
      </div>
      {status?.mode === "demo" && <div className="demo-checklist"><b>Explore the complete scenario</b><div><Link href="/overview">Overview</Link><Link href="/transactions">Transactions</Link><Link href="/review">Review exceptions</Link><Link href="/bills">Bills & income</Link><Link href="/planner">Cash Planner</Link><Link href="/reports">Reports</Link><Link href="/goals">Plans & goals</Link><Link href="/documents">Documents</Link><Link href="/assistant">Assistant</Link></div></div>}
    </Panel>
    <Panel span={5}>
      <p className="eyebrow">Permanent application deletion</p><h2>Delete household financial data</h2>
      <div className="danger-zone"><b>This cannot be undone inside Tallystead.</b><p>Deletes accounts, transactions, imports, bills, plans, assistant history, and stored documents. Household members, authentication, server configuration, and backup files outside the application remain.</p>
        <label>Type {status?.delete_confirmation ?? "the confirmation phrase"}<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label>
        <button className="button danger" disabled={busy || !status || deleteConfirmation !== status.delete_confirmation} onClick={deleteData}>Delete financial data</button>
      </div>
    </Panel>
  </div>;
}
