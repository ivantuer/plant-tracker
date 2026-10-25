import { signal } from '@preact/signals';
import { del, get, set } from 'idb-keyval';
import { DEFAULT_SERVER } from './config';
import { applySynced, hooks, patchSettings, sharedData, state } from './store';
import { canon, liveProtocols, liveUrl, mergeData, newVault, syncOnce, SyncAuthError, type Vault } from './sync-core';
import type { Log } from './types';

const VAULT_KEY = 'plant-care-vault';
const EMAIL_KEY = 'plant-care-google';

export const vault = signal<Vault | null>(null);
export const sync = signal({ live: false, busy: false, error: '', at: 0 });
/** The Google account this device signed in with. */
export const googleEmail = signal('');
/** Called with entries that the other person added, so the UI can say so. */
export const partner = { onLogs: (_logs: Log[]) => {} };
/** Called after each sync so other parts (push schedule) can follow the data. */
export const afterSync = { run: () => {} };

export const serverUrl = () => DEFAULT_SERVER.replace(/\/+$/, '');

let rev = 0;
let ws: WebSocket | null = null;
let ping = 0;
let retry = 0;
let backoff = 1000;
let debounce = 0;
let busy = false;
let again = false;

const patch = (p: Partial<ReturnType<typeof sync.peek>>) => (sync.value = { ...sync.value, ...p });

export async function syncNow() {
  const v = vault.value;
  if (!v) return;
  if (busy) { again = true; return; }
  busy = true;
  patch({ busy: true });
  try {
    const before = new Set(state.value.logs.map((l) => l.id));
    const r = await syncOnce(v, sharedData());
    rev = r.rev;
    // Edits made while the request was in flight are merged, not overwritten; they trigger their own sync.
    const merged = mergeData(sharedData(), r.data);
    if (canon(merged) !== canon(sharedData())) applySynced(merged);
    const me = state.value.settings.me;
    const fresh = merged.logs.filter((l) => !before.has(l.id) && l.by !== me && !l.skipped);
    if (fresh.length) partner.onLogs(fresh);
    patch({ error: '', at: Date.now() });
    afterSync.run();
  } catch (e) {
    patch({ error: e instanceof SyncAuthError ? 'auth' : e instanceof TypeError ? 'offline' : (e as Error).message });
  } finally {
    busy = false;
    patch({ busy: false });
    if (again) { again = false; void syncNow(); }
  }
}

// ---- live updates ----------------------------------------------------------------------------------------

function closeLive() {
  clearTimeout(retry);
  clearInterval(ping);
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  patch({ live: false });
}

/** Opens the socket the server uses to say "something changed". Reconnects with backoff; polling covers the gaps. */
function openLive() {
  closeLive();
  const v = vault.value;
  if (!v || typeof WebSocket === 'undefined') return;
  try {
    ws = new WebSocket(liveUrl(v), liveProtocols(v));
  } catch {
    return;
  }
  const mine = ws;
  mine.onopen = () => {
    backoff = 1000;
    patch({ live: true });
    ping = window.setInterval(() => mine.readyState === 1 && mine.send('ping'), 25_000);
    void syncNow();
  };
  mine.onmessage = (e) => {
    if (e.data === 'pong') return;
    try {
      const m = JSON.parse(String(e.data)) as { rev?: number };
      if (typeof m.rev === 'number' && m.rev <= rev) return;
    } catch { /* an unknown message still deserves a look */ }
    void syncNow();
  };
  mine.onclose = () => {
    clearInterval(ping);
    patch({ live: false });
    ws = null;
    retry = window.setTimeout(openLive, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  };
}

// ---- household -------------------------------------------------------------------------------------------

async function setVault(v: Vault | null) {
  vault.value = v;
  rev = 0;
  if (v) await set(VAULT_KEY, v);
  else await del(VAULT_KEY);
  if (v) openLive();
  else closeLive();
}

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${serverUrl()}${path}`, { method: 'POST', body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(j.error ?? `Sync server error ${res.status}`), { status: res.status });
  return j;
};

/** The person's first name from a Google ID token (only for display, so it is not verified here). */
function nameFrom(idToken: string): string {
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))) as { given_name?: string; name?: string };
    return p.given_name ?? p.name ?? '';
  } catch { return ''; }
}

/**
 * Signs in with Google. If this account already has a household (on another device, or shared with it), this device
 * opens it; otherwise a new household is created and linked to the account. Either way there is nothing to type.
 */
export async function connectGoogle(idToken: string) {
  let email = '';
  let v: Vault;
  try {
    const r = await postJson<{ path: string; bearer: string; key: string; email: string }>('/google/open', { idToken });
    v = { url: serverUrl(), path: r.path, bearer: r.bearer, key: r.key };
    email = r.email;
    await setVault(v);
    await syncNow();
  } catch (e) {
    if ((e as { status?: number }).status !== 404) throw e;
    v = newVault(serverUrl());
    await setVault(v);
    await syncNow();
    if (sync.value.error) { const msg = sync.value.error; await setVault(null); patch({ error: '' }); throw new Error(msg); }
    try {
      email = (await postJson<{ email: string }>('/google/link', { idToken, path: v.path, bearer: v.bearer, key: v.key })).email;
    } catch (err) { await setVault(null); throw err; }
  }
  if (sync.value.error) { const msg = sync.value.error; await setVault(null); patch({ error: '' }); throw new Error(msg); }
  googleEmail.value = email;
  await set(EMAIL_KEY, email);
  if (!state.value.settings.me.trim()) patchSettings({ me: nameFrom(idToken) });
}

/** Lets another Google account open this household by signing in with that email. */
export async function shareWith(email: string) {
  const v = vault.value;
  if (!v) throw new Error('household');
  await postJson('/google/share', { path: v.path, bearer: v.bearer, key: v.key, email });
}

export const leaveHousehold = async () => { await setVault(null); googleEmail.value = ''; await del(EMAIL_KEY); };

export function startSync() {
  hooks.dataChanged = () => {
    if (!vault.value) { afterSync.run(); return; }
    clearTimeout(debounce);
    debounce = window.setTimeout(() => void syncNow(), 500);
  };
  hooks.resumed = () => {
    if (!vault.value) return;
    if (!ws || ws.readyState > 1) openLive();
    void syncNow();
  };
  window.addEventListener('online', () => vault.value && (openLive(), void syncNow()));
  // Polling is the safety net behind the live socket (and the only path if sockets are blocked).
  setInterval(() => document.visibilityState === 'visible' && vault.value && !sync.value.live && void syncNow(), 60_000);
  void get<string>(EMAIL_KEY).then((e) => e && (googleEmail.value = e));
  void get<Vault>(VAULT_KEY).then((v) => {
    if (v) { vault.value = v; openLive(); void syncNow(); }
  });
}
