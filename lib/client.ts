export type Session = { access_token: string; user_id: string; household_id: string; role: string };
export type Me = { user_id: string; email: string; display_name: string; household_id: string; household_name: string; role: string; session_idle_minutes: number };
export type Server = { url: string; setup_required: boolean };

const SERVER_URL_KEY = "tallystead.serverUrl";
const SESSION_KEY = "tallystead.session";
const LEGACY_SERVER_URL_KEY = "nestledger.serverUrl";
const LEGACY_SESSION_KEY = "nestledger.session";

export async function apiRequest<T>(serverUrl: string, path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "The server could not complete that request.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function savedConnection(): { serverUrl: string; session: Session | null } | null {
  const serverUrl = window.localStorage.getItem(SERVER_URL_KEY) ?? window.localStorage.getItem(LEGACY_SERVER_URL_KEY) ?? window.location.origin;
  const saved = window.localStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(LEGACY_SESSION_KEY);
  if (saved) window.localStorage.setItem(SESSION_KEY, saved);
  window.localStorage.setItem(SERVER_URL_KEY, serverUrl);
  window.localStorage.removeItem(LEGACY_SERVER_URL_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
  return { serverUrl, session: saved ? JSON.parse(saved) as Session : null };
}

export function saveSession(serverUrl: string, session: Session) {
  window.localStorage.setItem(SERVER_URL_KEY, serverUrl);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
}
