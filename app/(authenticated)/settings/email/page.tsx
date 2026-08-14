"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAppSession } from "../../../../components/app-shell";
import { Notice, Panel, Pill } from "../../../../components/ui";
import { apiRequest } from "../../../../lib/client";

type IntegrationStatus = { smtp_configured: boolean; imap_configured: boolean; smtp_host:string|null; smtp_port:number|null; smtp_username:string|null; smtp_from_address:string|null; smtp_security:string|null; imap_host:string|null; imap_port:number|null; imap_username:string|null; imap_archive_processed: boolean; smtp_notifications_enabled: boolean };

export default function EmailPage() {
  const { serverUrl, session } = useAppSession();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => apiRequest<IntegrationStatus>(serverUrl, "/v1/system/integrations", {}, session.access_token).then(setStatus), [serverUrl, session]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const formElement = event.currentTarget; const data = new FormData(formElement); const payload: Record<string, string | number | boolean> = {};
    for (const [key, value] of data.entries()) if (value !== "") payload[key] = key.endsWith("_port") ? Number(value) : value.toString();
    payload.imap_archive_processed = data.has("imap_archive_processed"); payload.smtp_notifications_enabled = data.has("smtp_notifications_enabled");
    try { await apiRequest(serverUrl, "/v1/system/integrations", { method: "PUT", body: JSON.stringify(payload) }, session.access_token); formElement.reset(); await load(); setNotice("Email configuration saved. Secret fields remain write-only."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Configuration could not be saved."); } finally { setBusy(false); }
  }
  async function test(kind: "smtp" | "imap") { setBusy(true); try { const result = await apiRequest<{ detail: string }>(serverUrl, `/v1/system/integrations/test/${kind}`, { method: "POST" }, session.access_token); setNotice(result.detail); } catch (e) { setNotice(e instanceof Error ? e.message : "Connection test failed."); } finally { setBusy(false); } }

  return <form key={status ? JSON.stringify(status) : "loading"} className="page-form" onSubmit={save}>{notice && <Notice title="Email configuration">{notice}</Notice>}<div className="grid">
    <Panel span={7}><p className="eyebrow">Optional local integration</p><div className="title-with-status"><h2>Receipt email inbox (IMAP)</h2><Pill tone={status?.imap_configured ? "green" : "amber"}>{status?.imap_configured ? "Configured" : "Optional"}</Pill></div><p className="muted">Bring receipts, invoices, and statements into a review queue. Credentials stay encrypted on this server.</p><div className="form-grid"><label>IMAP host<input name="imap_host" defaultValue={status?.imap_host||""} placeholder="imap.mail.example" /></label><label>Port<input name="imap_port" type="number" min="1" max="65535" defaultValue={status?.imap_port||""} placeholder="993" /></label><label className="full-field">Email address<input name="imap_username" type="email" defaultValue={status?.imap_username||""} /></label><label className="full-field">App password<input name="imap_password" type="password" autoComplete="new-password" placeholder={status?.imap_configured?"Saved · enter only to replace":""} /></label></div><label className="toggle-row"><span><b>Archive processed messages</b><small>Move reviewed messages to a Tallystead folder</small></span><input name="imap_archive_processed" type="checkbox" defaultChecked={status?.imap_archive_processed} /></label><div className="row"><div><b>Incoming receipt processing</b><small>Messages enter the review queue; nothing posts automatically</small></div><Pill tone={status?.imap_configured ? "green" : "amber"}>{status?.imap_configured ? "Ready" : "Disabled"}</Pill></div><button type="button" className="button top-space" disabled={busy || !status?.imap_configured} onClick={() => test("imap")}>Test incoming connection</button></Panel>
    <Panel span={5}><p className="eyebrow">Notifications & recovery</p><div className="title-with-status"><h2>Outgoing email (SMTP)</h2><Pill tone={status?.smtp_configured ? "green" : "amber"}>{status?.smtp_configured ? "Configured" : "Optional"}</Pill></div><div className="form-grid one-column"><label>SMTP host<input name="smtp_host" defaultValue={status?.smtp_host||""} placeholder="smtp.mail.example" /></label><label>Port<input name="smtp_port" type="number" min="1" max="65535" defaultValue={status?.smtp_port||""} placeholder="587" /></label><label>Username<input name="smtp_username" defaultValue={status?.smtp_username||""} /></label><label>Password<input name="smtp_password" type="password" autoComplete="new-password" placeholder={status?.smtp_configured?"Saved · enter only to replace":""} /></label><label>From address<input name="smtp_from_address" type="email" defaultValue={status?.smtp_from_address||""} /></label><label>Security<select name="smtp_security" defaultValue={status?.smtp_security||""}><option value="">Choose security</option><option value="starttls">STARTTLS</option><option value="tls">TLS</option><option value="none">None · trusted local relay</option></select></label></div><label className="toggle-row"><span><b>Send email notifications</b><small>Recovery and operational results; no financial details by default</small></span><input name="smtp_notifications_enabled" type="checkbox" defaultChecked={status?.smtp_notifications_enabled} /></label><div className="row"><div><b>Password recovery</b><small>Owner recovery remains available if email fails</small></div><Pill tone={status?.smtp_configured ? "green" : "amber"}>{status?.smtp_configured ? "Enabled" : "Owner only"}</Pill></div><button type="button" className="button top-space" disabled={busy || !status?.smtp_configured} onClick={() => test("smtp")}>Test outgoing email</button><Notice title="Local boundary">Tallystead does not receive, relay, or retain your email outside this server.</Notice></Panel>
  </div><div className="page-save"><button className="button primary" disabled={busy}>Save email configuration</button></div></form>;
}
