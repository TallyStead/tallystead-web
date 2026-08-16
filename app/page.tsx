"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, saveSession, savedConnection, Server, Session } from "../lib/client";
import { authenticationCredential, authenticationPublicKey, PasskeyOptions } from "../lib/webauthn";
import { BrandWordmark } from "../components/brand";

type ServerIdentity = { public_url: string; api_version: string };
type ProxyIdentity = { available: boolean; email: string | null; display_name: string | null };
const defaultServer = typeof window === "undefined" ? "https://localhost:8443" : window.location.origin;

export default function ConnectionPage() {
  const router = useRouter();
  const [server, setServer] = useState<Server | null>(null);
  const [serverInput, setServerInput] = useState(defaultServer);
  const [resetToken, setResetToken] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupDemo, setSetupDemo] = useState(false);
  const [proxyIdentity, setProxyIdentity] = useState<ProxyIdentity | null>(null);

  useEffect(() => {
    setResetToken(new URLSearchParams(window.location.search).get("reset_token") ?? "");
    const saved = savedConnection();
    if (!saved) return;
    setServerInput(saved.serverUrl);
    if (saved.session) { router.replace("/overview"); return; }
    void reconnect(saved.serverUrl);
  }, [router]);

  async function reconnect(url: string) {
    const [status, proxy] = await Promise.all([
      apiRequest<{ setup_required: boolean }>(url, "/v1/setup/status"),
      apiRequest<ProxyIdentity>(url, "/v1/auth/proxy/status").catch(() => ({ available: false, email: null, display_name: null })),
    ]);
    setServer({ url, setup_required: status.setup_required });
    setProxyIdentity(proxy);
  }

  async function connect(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const entered = serverInput.replace(/\/$/, "");
      const identity = await apiRequest<ServerIdentity>(entered, "/v1/server/identity");
      const canonical = identity.public_url.replace(/\/$/, "");
      await reconnect(canonical); window.localStorage.setItem("tallystead.serverUrl", canonical); setServerInput(canonical);
      setNotice(`Connected securely to Tallystead ${identity.api_version}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function acceptSession(result: Session) {
    saveSession(server!.url, result); router.replace("/overview");
  }

  async function setup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await acceptSession(await apiRequest<Session>(server!.url, "/v1/setup", { method: "POST", body: JSON.stringify({ household_name: form.get("householdName"), display_name: form.get("displayName"), email: form.get("email"), password: form.get("password"), device_name: "Web browser", create_demo: setupDemo, demo_reference_date: form.get("demoReferenceDate") || null, demo_volume: form.get("demoVolume") || "realistic" }) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Setup failed."); setBusy(false); }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await acceptSession(await apiRequest<Session>(server!.url, "/v1/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password"), device_name: "Web browser" }) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sign-in failed."); setBusy(false); }
  }

  async function passkeyLogin(event: MouseEvent<HTMLButtonElement>) {
    if (!server || !event.currentTarget.form || !window.PublicKeyCredential) return;
    const email = new FormData(event.currentTarget.form).get("email");
    if (!email) { setNotice("Enter your email address first."); return; }
    setBusy(true); setNotice("");
    try {
      const options = await apiRequest<PasskeyOptions>(server.url, "/v1/auth/passkeys/login/options", { method: "POST", body: JSON.stringify({ email }) });
      const assertion = await navigator.credentials.get({ publicKey: authenticationPublicKey(options.public_key) }) as PublicKeyCredential | null;
      if (!assertion) throw new Error("Passkey sign-in was cancelled.");
      await acceptSession(await apiRequest<Session>(server.url, "/v1/auth/passkeys/login/finish", { method: "POST", body: JSON.stringify({ ceremony_id: options.ceremony_id, credential: authenticationCredential(assertion), device_name: "Web browser · Passkey" }) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Passkey sign-in failed."); setBusy(false); }
  }

  async function proxyLogin() {
    if (!server) return;
    setBusy(true); setNotice("");
    try {
      await acceptSession(await apiRequest<Session>(server.url, "/v1/auth/proxy/login", { method: "POST", body: JSON.stringify({ device_name: "Web browser · Pangolin" }) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Pangolin sign-in failed."); setBusy(false); }
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!server) return; setBusy(true);
    try { await apiRequest<void>(server.url, "/v1/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email: new FormData(event.currentTarget).get("email") }) }); setNotice("If email recovery is configured for that account, a reset message has been sent."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Recovery request failed."); }
    finally { setBusy(false); }
  }

  async function finishReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!server) return; setBusy(true);
    try { await apiRequest<void>(server.url, "/v1/auth/password-reset/finish", { method: "POST", body: JSON.stringify({ token: resetToken, password: new FormData(event.currentTarget).get("password") }) }); window.history.replaceState({}, "", "/"); setResetToken(""); setNotice("Password updated. Sign in with your new password."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Password reset failed."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="auth-brand"><BrandWordmark className="auth-logo" dark lockup /><h1>Steady finances.<br />Stronger household.</h1><p>Your private household finances stay on the server under your roof.</p><span className="pill green">Local-first · No cloud account</span></section>
    <section className="auth-panel"><p className="eyebrow">Tallystead · Local server</p><h2>{!server ? "Connect to your household" : server.setup_required ? "Create your household" : "Welcome back"}</h2>{notice && <p className="status-message" role="status">{notice}</p>}
      {!server && <form onSubmit={connect}><label>Server URL<input value={serverInput} onChange={(event) => setServerInput(event.target.value)} placeholder="https://tallystead.home.arpa" required /></label><p className="field-help">Use the secure address shown by your Tallystead server.</p><button className="button primary" disabled={busy}>{busy ? "Connecting…" : "Connect securely"}</button></form>}
      {server?.setup_required && <form onSubmit={setup}><label>Household name<input name="householdName" required /></label><label>Your name<input name="displayName" required /></label><label>Email address<input name="email" type="email" required /></label><label>Password<input name="password" type="password" minLength={12} required /></label><label className="check-line"><input type="checkbox" checked={setupDemo} onChange={(event) => setSetupDemo(event.target.checked)} /> Start with clearly fictional demo data</label>{setupDemo && <><label>Demo reference date<input name="demoReferenceDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Fixture size<select name="demoVolume" defaultValue="realistic"><option value="realistic">Realistic · nine months</option><option value="smoke">Smoke test · two months</option></select></label><p className="field-help">All names, values, imports, and documents are generated locally and marked as fictional.</p></>}<button className="button primary" disabled={busy}>Create local household</button></form>}
      {server && !server.setup_required && <>{proxyIdentity?.available&&<div className="proxy-sign-in"><p><b>{proxyIdentity.display_name||proxyIdentity.email}</b><br/><span className="field-help">Authenticated by Pangolin. A matching active Tallystead member is required.</span></p><button type="button" className="button primary" disabled={busy} onClick={()=>void proxyLogin()}>Continue with Pangolin</button></div>}<form onSubmit={login}><label>Email address<input name="email" type="email" required /></label><label>Password<input name="password" type="password" required /></label><button className="button primary" disabled={busy}>Sign in with password</button><button type="button" className="button" disabled={busy} onClick={passkeyLogin}>Sign in with a passkey</button></form><details open={Boolean(resetToken)}><summary>Password recovery</summary><form onSubmit={requestReset}><label>Email address<input name="email" type="email" required /></label><button className="button">Email a reset link</button></form>{resetToken && <form onSubmit={finishReset}><label>New password<input name="password" type="password" minLength={12} required /></label><button className="button primary">Set new password</button></form>}<p className="field-help">A household Owner can also recover your account locally.</p></details></>}
    </section></main>;
}
