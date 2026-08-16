"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "../../../../components/app-shell";
import { Notice, Panel, Pill } from "../../../../components/ui";
import { apiRequest } from "../../../../lib/client";

type Status = { environment: string; database_connected: boolean; object_store_configured: boolean; worker_healthy: boolean; worker_last_seen_at: string | null; latest_backup_status: string | null; latest_backup_at: string | null };
type NetworkConfig = { canonical_url: string; internal_url: string | null; access_mode: string; trusted_proxy_cidrs: string[]; forward_auth_enabled: boolean; certificate_mode: string };
type Network = { configuration: NetworkConfig; certificate: { subject: string | null; issuer: string | null; names: string[]; expires_at: string | null; renewal_status: string } };
type Diagnostic = { effective_url: string; scheme: string; host: string; source_address: string | null; transport_address: string | null; connection_route: string; forwarded_headers_trusted: boolean; headers: { name: string; value: string }[] };

export default function ServerPage() {
  const { serverUrl, session } = useAppSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(<T,>(path: string, init: RequestInit = {}) => apiRequest<T>(serverUrl, path, init, session.access_token), [serverUrl, session.access_token]);
  const load = useCallback(async () => {
    const [serverStatus, networkStatus] = await Promise.all([request<Status>("/v1/system/status"), request<Network>("/v1/system/network")]);
    setStatus(serverStatus); setNetwork(networkStatus);
  }, [request]);
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  async function diagnose() {
    setBusy(true); setError("");
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

  if (!network) return <div className="grid"><Panel span={12}><p>{error || "Loading server configuration…"}</p></Panel></div>;
  const config = network.configuration;
  return <div className="grid">
    {error && <div className="span-12"><Notice title="Server configuration">{error}</Notice></div>}
    <Panel span={7}><p className="eyebrow">Environment configuration</p><h2>Server addresses</h2><p className="muted">Network settings are read from the deployment&apos;s <code>.env</code> file. Edit that file and recreate API and Caddy to make changes.</p><div className="row top-space"><div><b>Public URL</b><small>Browser, passkey, generated-link, and mobile identity</small></div><b>{config.canonical_url}</b></div><div className="row"><div><b>Internal URL</b><small>Optional direct recovery address</small></div><b>{config.internal_url || "Not configured"}</b></div><div className="row"><div><b>Access mode</b><small>Configured deployment path</small></div><Pill>{config.access_mode.replaceAll("_", " ")}</Pill></div><div className="row"><div><b>Trusted proxies</b><small>{config.trusted_proxy_cidrs.length ? config.trusted_proxy_cidrs.join(", ") : "Forwarded headers are not trusted"}</small></div><Pill tone={config.trusted_proxy_cidrs.length ? "green" : "amber"}>{config.trusted_proxy_cidrs.length}</Pill></div><div className="row"><div><b>Pangolin identity</b><small>Existing active members only</small></div><Pill tone={config.forward_auth_enabled ? "green" : "amber"}>{config.forward_auth_enabled ? "Enabled" : "Disabled"}</Pill></div></Panel>
    <Panel span={5}><p className="eyebrow">Certificates</p><h2>HTTPS identity</h2><div className="row"><div><b>Mode</b><small>{config.certificate_mode.replaceAll("_", " ")}</small></div><Pill tone={network.certificate.renewal_status === "valid" ? "green" : "amber"}>{network.certificate.renewal_status}</Pill></div><div className="row"><div><b>Issuer</b><small>{network.certificate.issuer ?? "Certificate details unavailable"}</small></div></div><div className="row"><div><b>Expires</b><small>{network.certificate.expires_at ? new Date(network.certificate.expires_at).toLocaleString() : "Not reported"}</small></div></div><button className="button full-width top-space" disabled={busy} onClick={exportRoot}>Export local CA certificate</button></Panel>
    <Panel span={7}><p className="eyebrow">Service health</p><h2>Local services</h2><div className="row"><div><b>Database</b><small>Authoritative household records</small></div><Pill tone={status?.database_connected ? "green" : "red"}>{status?.database_connected ? "Connected" : "Unavailable"}</Pill></div><div className="row"><div><b>Document storage</b><small>Local object storage</small></div><Pill tone={status?.object_store_configured ? "green" : "amber"}>{status?.object_store_configured ? "Configured" : "Needs setup"}</Pill></div><div className="row"><div><b>Background worker</b><small>{status?.worker_last_seen_at ? `Last seen ${new Date(status.worker_last_seen_at).toLocaleString()}` : "No heartbeat received"}</small></div><Pill tone={status?.worker_healthy ? "green" : "red"}>{status?.worker_healthy ? "Healthy" : "Not reporting"}</Pill></div><div className="row"><div><b>Latest backup</b><small>{status?.latest_backup_at ? new Date(status.latest_backup_at).toLocaleString() : "No backup recorded"}</small></div><Pill tone={status?.latest_backup_status === "succeeded" ? "green" : "amber"}>{status?.latest_backup_status ?? "Not run"}</Pill></div></Panel>
    <Panel span={5}><p className="eyebrow">Apply changes</p><h2>Host-managed configuration</h2><p>After editing <code>.env</code>, recreate the services from the installation directory:</p><pre><code>docker compose up -d --force-recreate api caddy</code></pre><p className="muted">This page is intentionally read-only so a web setting cannot make the server unreachable.</p></Panel>
    <Panel span={12}><div className="connection-diagnostic-heading"><div><p className="eyebrow">Owner-only diagnostics</p><h2>Current connection</h2><p className="muted">Inspect how this browser reaches the API. Credentials, cookies, and proxy secrets are redacted.</p></div><button className="button" disabled={busy} onClick={diagnose}>{diagnostic ? "Refresh connection" : "Inspect connection"}</button></div>{!diagnostic && <p className="empty-inline top-space">Open the direct or Pangolin URL you want to test, then run this diagnostic.</p>}{diagnostic && <><div className="connection-diagnostic-summary top-space"><div><small>Effective URL</small><b>{diagnostic.effective_url}</b></div><div><small>Connection route</small><b>{diagnostic.connection_route.replaceAll("_", " ")}</b></div><div><small>Transport source</small><b>{diagnostic.transport_address ?? "unknown"}</b></div><div><small>Effective client source</small><b>{diagnostic.source_address ?? "unknown"}</b></div><div><small>Forwarded headers</small><Pill tone={diagnostic.forwarded_headers_trusted ? "green" : "amber"}>{diagnostic.forwarded_headers_trusted ? "trusted" : "ignored"}</Pill></div></div><div className="connection-header-table" role="table" aria-label="Sanitized request headers">{diagnostic.headers.map((header) => <div className="connection-header-row" role="row" key={header.name}><code role="cell">{header.name}</code><code role="cell">{header.value}</code></div>)}</div></>}</Panel>
  </div>;
}
