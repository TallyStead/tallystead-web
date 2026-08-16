"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAppSession } from "../../../../components/app-shell";
import { Notice, Panel, Pill } from "../../../../components/ui";
import { apiRequest } from "../../../../lib/client";

type Status = { environment: string; database_connected: boolean; object_store_configured: boolean; smtp_configured: boolean; passkeys_enabled: boolean; worker_healthy: boolean; worker_last_seen_at: string | null; latest_backup_status: string | null; latest_backup_at: string | null };
type NetworkConfig = { canonical_url: string; internal_url: string | null; access_mode: string; trusted_proxy_cidrs: string[]; forward_auth_enabled: boolean; certificate_mode: string; dns_provider: string | null; dns_zone: string | null; cloudflare_configured: boolean; acme_email: string | null; internet_exposure_confirmed: boolean };
type Check = { name: string; status: string; detail: string };
type Network = { active: NetworkConfig; staged: NetworkConfig | null; last_known_good: NetworkConfig | null; last_test: { ready: boolean; tested_at: string; checks: Check[] } | null; revision: number; canonical_change_warning: boolean; certificate: { subject: string | null; issuer: string | null; names: string[]; expires_at: string | null; renewal_status: string } };
type Diagnostic = { effective_url: string; scheme: string; host: string; source_address: string | null; transport_address: string | null; connection_route: string; forwarded_headers_trusted: boolean; headers: { name: string; value: string }[] };

const accessModes = [
  ["lan", "Local network only"],
  ["reverse_proxy", "Internal load balancer / reverse proxy"],
  ["vpn", "VPN or private tunnel"],
  ["internet", "Direct internet access"],
];
const certificateModes = [
  ["local_ca", "Caddy local CA"],
  ["public_acme", "Public ACME (HTTP-01 / TLS-ALPN-01)"],
  ["cloudflare_dns", "Cloudflare DNS-01"],
  ["external_tls", "TLS terminated by an upstream load balancer"],
];

export default function ServerPage() {
  const { serverUrl, session } = useAppSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [certificateMode, setCertificateMode] = useState("local_ca");
  const [accessMode, setAccessMode] = useState("lan");
  const [forwardAuthEnabled, setForwardAuthEnabled] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(<T,>(path: string, init: RequestInit = {}) => apiRequest<T>(serverUrl, path, init, session.access_token), [serverUrl, session.access_token]);
  const load = useCallback(async () => {
    const [serverStatus, networkStatus] = await Promise.all([request<Status>("/v1/system/status"), request<Network>("/v1/system/network")]);
    setStatus(serverStatus);
    setNetwork(networkStatus);
    const editable = networkStatus.staged ?? networkStatus.active;
    setCertificateMode(editable.certificate_mode);
    setAccessMode(editable.access_mode);
    setForwardAuthEnabled(editable.forward_auth_enabled);
  }, [request]);
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  async function stage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request<Network>("/v1/system/network/stage", { method: "PUT", body: JSON.stringify({ canonical_url: form.get("canonical_url"), internal_url: form.get("internal_url") || null, access_mode: form.get("access_mode"), trusted_proxy_cidrs: String(form.get("trusted_proxy_cidrs") || "").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean), forward_auth_enabled: form.has("forward_auth_enabled"), certificate_mode: form.get("certificate_mode"), dns_provider: form.get("certificate_mode") === "cloudflare_dns" ? "cloudflare" : null, dns_zone: form.get("dns_zone") || null, cloudflare_api_token: form.get("cloudflare_api_token") || null, acme_email: form.get("acme_email") || null, internet_exposure_confirmed: form.has("internet_exposure_confirmed") }) });
      setNetwork(result); setNotice("Network changes staged. Run all readiness checks before activation.");
    } catch (e) { setError(e instanceof Error ? e.message : "Network changes could not be staged."); }
    finally { setBusy(false); }
  }
  async function action(path: string, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { const result = await request<Network>(path, { method: "POST" }); setNetwork(result); setNotice(message); return result; }
    catch (e) { setError(e instanceof Error ? e.message : "The network operation failed."); return null; }
    finally { setBusy(false); }
  }
  async function testConfiguration() {
    setBusy(true); setError(""); setNotice("");
    try { const result = await request<Network["last_test"]>("/v1/system/network/test", { method: "POST" }); await load(); setNotice(result?.ready ? "All staged network checks passed. The configuration is ready to activate." : "One or more checks failed. Nothing was activated."); }
    catch (e) { setError(e instanceof Error ? e.message : "Network checks failed."); }
    finally { setBusy(false); }
  }
  async function apply() {
    const nextUrl = network?.staged?.canonical_url;
    const result = await action("/v1/system/network/apply", "Network configuration activated and saved as the new working configuration.");
    if (result && nextUrl && nextUrl !== serverUrl) {
      window.localStorage.setItem("tallystead.serverUrl", nextUrl);
      window.setTimeout(() => window.location.assign(`${nextUrl}/settings/server`), 900);
    }
  }
  async function diagnose() {
    setBusy(true);
    try { setDiagnostic(await request<Diagnostic>("/v1/system/network/effective-request")); }
    catch (e) { setError(e instanceof Error ? e.message : "Request identity test failed."); }
    finally { setBusy(false); }
  }
  async function exportRoot() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${serverUrl}/v1/system/network/caddy-root`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? "Local CA certificate is unavailable."); }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob()); link.download = "tallystead-caddy-root.pem"; link.click(); URL.revokeObjectURL(link.href);
    } catch (e) { setError(e instanceof Error ? e.message : "Local CA certificate is unavailable."); }
    finally { setBusy(false); }
  }
  function usePangolinPreset() {
    setAccessMode("reverse_proxy");
    setCertificateMode("external_tls");
    setForwardAuthEnabled(true);
    setError("");
    setNotice("Pangolin proxy settings selected. Keep the public Pangolin URL as the canonical URL and add the Pangolin Docker subnet under trusted proxy settings before staging.");
  }

  if (!network) return <div className="grid"><Panel span={12}><p>{error || "Loading server configuration…"}</p></Panel></div>;
  const editable = network.staged ?? network.active;
  return <div className="grid">
    {(notice || error) && <div className="span-12"><Notice title={error ? "Server configuration" : "Server update"}>{error || notice}</Notice></div>}
    <Panel span={7}><p className="eyebrow">Household-operated server</p><h2>Local server</h2><div className="row"><div><b>Canonical client URL</b><small>One identity for browsers, passkeys, generated links, and future mobile apps</small></div><b>{network.active.canonical_url}</b></div><div className="row"><div><b>Database</b><small>Authoritative household records</small></div><Pill tone={status?.database_connected ? "green" : "red"}>{status?.database_connected ? "Connected" : "Unavailable"}</Pill></div><div className="row"><div><b>Document storage</b><small>Local MinIO object store</small></div><Pill tone={status?.object_store_configured ? "green" : "amber"}>{status?.object_store_configured ? "Configured" : "Needs setup"}</Pill></div><div className="row"><div><b>Background worker</b><small>{status?.worker_last_seen_at ? `Last seen ${new Date(status.worker_last_seen_at).toLocaleString()}` : "No heartbeat received"}</small></div><Pill tone={status?.worker_healthy ? "green" : "red"}>{status?.worker_healthy ? "Healthy" : "Not reporting"}</Pill></div></Panel>
    <Panel span={5}><p className="eyebrow">Certificates</p><h2>HTTPS identity</h2><div className="row"><div><b>Mode</b><small>{network.active.certificate_mode.replaceAll("_", " ")}</small></div><Pill tone={network.certificate.renewal_status === "valid" ? "green" : "amber"}>{network.certificate.renewal_status}</Pill></div><div className="row"><div><b>Issuer</b><small>{network.certificate.issuer ?? "Certificate details unavailable"}</small></div></div><div className="row"><div><b>Expires</b><small>{network.certificate.expires_at ? new Date(network.certificate.expires_at).toLocaleString() : "Not reported"}</small></div></div><button className="button full-width top-space" disabled={busy} onClick={exportRoot}>Export local CA certificate</button></Panel>
    <Panel span={12}><p className="eyebrow">Staged and recoverable</p><h2>Network & certificate configuration</h2><p className="muted network-config-intro">Save a draft here, check that it is ready, then activate it below. The active connection stays unchanged until every check passes.</p>{network.canonical_change_warning && <Notice title="Passkey origin will change">Existing passkeys are bound to the active canonical hostname. Users may need to enroll new passkeys after this change.</Notice>}<form className="network-config-form" onSubmit={stage} key={`${network.revision}-${editable.canonical_url}-${network.staged ? "staged" : "active"}`}>
      <section className="network-config-section"><div className="network-config-heading"><h3>Pangolin proxy</h3><small>Use the private Caddy ingress from a shared Docker network without publishing Tallystead on the host.</small></div><div><button type="button" className="button" disabled={busy} onClick={usePangolinPreset}>Use Pangolin proxy settings</button><small className="field-help">Pangolin target: HTTP, host <code>caddy</code>, port <code>8080</code>. Add Pangolin&apos;s Docker subnet as a trusted proxy below.</small></div></section>
      <section className="network-config-section"><div className="network-config-heading"><h3>Server addresses</h3><small>The canonical address is the one household members and future mobile apps use.</small></div><div className="network-config-grid"><label className={accessMode === "lan" ? "full-field" : undefined}>Canonical client URL<input name="canonical_url" type="url" defaultValue={editable.canonical_url} required /></label>{accessMode !== "lan" && <label>Internal HTTPS upstream URL<input name="internal_url" type="url" defaultValue={editable.internal_url ?? ""} placeholder="https://service.local.example.com" /></label>}</div></section>
      <section className="network-config-section"><div className="network-config-heading"><h3>Connection security</h3><small>Choose how clients reach this server and how Caddy provides HTTPS.</small></div><div className="network-config-grid"><label>Access mode<select name="access_mode" value={accessMode} onChange={(event) => setAccessMode(event.target.value)}>{accessModes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Certificate mode<select name="certificate_mode" value={certificateMode} onChange={(event) => setCertificateMode(event.target.value)}>{certificateModes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div></section>
      <details className="network-advanced" open={accessMode === "reverse_proxy" || editable.trusted_proxy_cidrs.length > 0}><summary>Advanced proxy settings <span>{editable.trusted_proxy_cidrs.length ? `${editable.trusted_proxy_cidrs.length} configured` : "Optional"}</span></summary><label>Trusted proxy IP addresses or CIDRs<textarea name="trusted_proxy_cidrs" rows={2} defaultValue={editable.trusted_proxy_cidrs.join("\n")} placeholder={"192.168.10.20/32\n10.20.0.0/24"} /><small>Only these load balancers may supply forwarded client headers. Enter one CIDR per line.</small></label>{accessMode==="reverse_proxy"&&<label className="checkbox-line"><input name="forward_auth_enabled" type="checkbox" checked={forwardAuthEnabled} onChange={event=>setForwardAuthEnabled(event.target.checked)}/> Accept Pangolin forwarded identity for existing active members</label>}</details>
      {certificateMode === "cloudflare_dns" && <section className="network-config-section"><div className="network-config-heading"><h3>Cloudflare DNS</h3><small>The token is encrypted and never shown again after it is saved.</small></div><div className="network-config-grid"><label>Cloudflare DNS zone<input name="dns_zone" defaultValue={editable.dns_zone ?? ""} placeholder="example.com" required /></label><label>Cloudflare API token<input name="cloudflare_api_token" type="password" placeholder={editable.cloudflare_configured ? "Configured — leave blank to keep" : "Scoped Zone:Read and DNS:Edit token"} /></label></div></section>}
      {(certificateMode === "public_acme" || certificateMode === "cloudflare_dns") && <label className="network-acme-email">ACME account email<input name="acme_email" type="email" defaultValue={editable.acme_email ?? ""} /></label>}
      {accessMode === "internet" && <div className="danger-zone"><label className="checkbox-line"><input type="checkbox" name="internet_exposure_confirmed" defaultChecked={editable.internet_exposure_confirmed} required /> I understand that direct internet access requires firewall, update, authentication, backup, and Phase 7 security readiness.</label></div>}
      <div className="network-config-actions"><button className="button primary" disabled={busy}>Stage configuration</button></div>
    </form></Panel>
    <Panel span={7}><p className="eyebrow">Preflight</p><h2>Readiness checks</h2>{!network.last_test && <p className="empty-inline">Stage the configuration, then run the DNS, Caddy, upstream, proxy, certificate, and origin checks.</p>}{network.last_test?.checks.map((check) => <div className="row" key={check.name}><div><b>{check.name.replaceAll("_", " ")}</b><small>{check.detail}</small></div><Pill tone={check.status === "pass" ? "green" : check.status === "warning" ? "amber" : "red"}>{check.status}</Pill></div>)}<div className="row-actions top-space"><button className="button" disabled={busy || !network.staged} onClick={testConfiguration}>Run readiness checks</button><button className="button primary" disabled={busy || !network.last_test?.ready} onClick={apply}>Activate tested configuration</button></div></Panel>
    <Panel span={5}><p className="eyebrow">Recovery</p><h2>Last known good</h2><div className="row"><div><b>Active revision</b><small>{network.active.canonical_url}</small></div><Pill>{network.revision}</Pill></div><button className="button full-width" disabled={busy || !network.last_known_good} onClick={() => { if (window.confirm("Restore the last known-good network and certificate configuration?")) void action("/v1/system/network/rollback", "Last known-good network configuration restored."); }}>Restore previous configuration</button><div className="row top-space"><div><b>Latest backup</b><small>{status?.latest_backup_at ? new Date(status.latest_backup_at).toLocaleString() : "No backup recorded"}</small></div><Pill tone={status?.latest_backup_status === "succeeded" ? "green" : "amber"}>{status?.latest_backup_status ?? "Not run"}</Pill></div></Panel>
    <Panel span={12}><div className="connection-diagnostic-heading"><div><p className="eyebrow">Owner-only diagnostics</p><h2>Current connection</h2><p className="muted">Inspect how this browser request reaches the API. Credentials, cookies, and proxy secrets are always redacted.</p></div><button className="button" disabled={busy} onClick={diagnose}>{diagnostic ? "Refresh connection" : "Inspect connection"}</button></div>{!diagnostic && <p className="empty-inline top-space">Run the diagnostic through the address you want to test, such as the Pangolin URL or direct recovery URL.</p>}{diagnostic && <><div className="connection-diagnostic-summary top-space"><div><small>Effective URL</small><b>{diagnostic.effective_url}</b></div><div><small>Connection route</small><b>{diagnostic.connection_route.replaceAll("_", " ")}</b></div><div><small>Transport source</small><b>{diagnostic.transport_address ?? "unknown"}</b></div><div><small>Effective client source</small><b>{diagnostic.source_address ?? "unknown"}</b></div><div><small>Forwarded headers</small><Pill tone={diagnostic.forwarded_headers_trusted ? "green" : "amber"}>{diagnostic.forwarded_headers_trusted ? "trusted" : "ignored"}</Pill></div></div><div className="connection-header-table" role="table" aria-label="Sanitized request headers">{diagnostic.headers.map((header) => <div className="connection-header-row" role="row" key={header.name}><code role="cell">{header.name}</code><code role="cell">{header.value}</code></div>)}</div></>}</Panel>
  </div>;
}
