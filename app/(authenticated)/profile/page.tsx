"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "../../../components/app-shell";
import { Notice, Panel, Pill } from "../../../components/ui";
import { apiRequest, clearSession } from "../../../lib/client";
import { PasskeyOptions, registrationCredential, registrationPublicKey } from "../../../lib/webauthn";

type Device = { session_id: string; user_id: string; device_name: string | null; created_at: string; expires_at: string; is_current: boolean };
type Passkey = { passkey_id: string; created_at: string; last_used_at: string | null };

export default function ProfilePage() {
  const router = useRouter();
  const { me, serverUrl, session } = useAppSession();
  const isOwner = me.role === "owner";
  const [devices, setDevices] = useState<Device[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [deviceList, passkeyList] = await Promise.all([
      apiRequest<Device[]>(serverUrl, "/v1/auth/sessions", {}, session.access_token),
      apiRequest<Passkey[]>(serverUrl, "/v1/auth/passkeys", {}, session.access_token),
    ]);
    setDevices(deviceList);
    setPasskeys(passkeyList);
  }, [serverUrl, session.access_token]);
  useEffect(() => { void load(); }, [load]);

  async function addPasskey() {
    if (!window.PublicKeyCredential) return setNotice("This browser does not support passkeys.");
    setBusy(true);
    try {
      const options = await apiRequest<PasskeyOptions>(serverUrl, "/v1/auth/passkeys/register/options", { method: "POST" }, session.access_token);
      const created = await navigator.credentials.create({ publicKey: registrationPublicKey(options.public_key) }) as PublicKeyCredential | null;
      if (!created) throw new Error("Passkey creation was cancelled.");
      await apiRequest(serverUrl, "/v1/auth/passkeys/register/finish", { method: "POST", body: JSON.stringify({ ceremony_id: options.ceremony_id, credential: registrationCredential(created) }) }, session.access_token);
      await load();
      setNotice("Passkey added to your account.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Passkey could not be added.");
    } finally { setBusy(false); }
  }

  async function removePasskey(id: string) {
    setBusy(true);
    try {
      await apiRequest(serverUrl, `/v1/auth/passkeys/${id}`, { method: "DELETE" }, session.access_token);
      await load();
      setNotice("Passkey removed. You can still sign in with your password.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Passkey could not be removed.");
    } finally { setBusy(false); }
  }

  async function revoke(device: Device) {
    setBusy(true);
    try {
      await apiRequest(serverUrl, `/v1/auth/sessions/${device.session_id}`, { method: "DELETE" }, session.access_token);
      if (device.is_current) {
        clearSession();
        router.replace("/");
        return;
      }
      await load();
      setNotice("Device session revoked.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Session could not be revoked.");
    } finally { setBusy(false); }
  }

  return <div className="grid">
    {notice && <div className="span-12"><Notice title="Security update">{notice}</Notice></div>}
    <Panel span={7}>
      <p className="eyebrow">Personal account</p>
      <h2>Profile details</h2>
      <div className="row"><div><b>Display name</b><small>Shown to members of this household</small></div><span>{me.display_name}</span></div>
      <div className="row"><div><b>Email address</b><small>Used for sign-in and recovery when SMTP is configured</small></div><span>{me.email}</span></div>
      <div className="row"><div><b>Household role</b><small>Controls access to household and server settings</small></div><Pill>{me.role}</Pill></div>
      <div className="row"><div><b>Household</b><small>Your data remains scoped to this household</small></div><span>{me.household_name}</span></div>
    </Panel>
    <Panel span={5}>
      <p className="eyebrow">Account access</p>
      <h2>Security and server</h2>
      <div className="row"><div><b>Connected server</b><small>{new URL(serverUrl).host}</small></div><Pill>Online</Pill></div>
      {isOwner ? <Link className="button full-width top-space" href="/settings/access">Manage household access</Link> : <p className="empty-inline top-space">An Owner manages household roles and account recovery. Your personal security controls are available below.</p>}
    </Panel>
    <Panel span={6}>
      <p className="eyebrow">Passwordless sign-in</p><h2>Your passkeys</h2>
      <p className="muted">Passkeys belong to your account and this server’s HTTPS identity.</p>
      {passkeys.length === 0 && <p className="empty-inline">No passkeys enrolled yet.</p>}
      {passkeys.map((passkey) => <div className="row" key={passkey.passkey_id}><div><b>Passkey</b><small>{passkey.last_used_at ? `Last used ${new Date(passkey.last_used_at).toLocaleString()}` : `Added ${new Date(passkey.created_at).toLocaleString()}`}</small></div><button className="button compact" disabled={busy} onClick={() => removePasskey(passkey.passkey_id)}>Remove</button></div>)}
      <button className="button primary top-space" disabled={busy} onClick={addPasskey}>Add a passkey</button>
    </Panel>
    <Panel span={6}>
      <p className="eyebrow">Your devices</p><h2>Active sessions</h2>
      <p className="muted">Review and sign out devices connected to your account.</p>
      {devices.length === 0 && <p className="empty-inline">No active device sessions.</p>}
      {devices.map((device) => <div className="row" key={device.session_id}><div><b>{device.device_name ?? "Unnamed device"}</b><small>Expires {new Date(device.expires_at).toLocaleDateString()}</small></div><div className="row-actions">{device.is_current && <Pill>Current device</Pill>}<button className="button compact" disabled={busy} onClick={() => revoke(device)}>{device.is_current ? "Sign out" : "Revoke"}</button></div></div>)}
    </Panel>
  </div>;
}
