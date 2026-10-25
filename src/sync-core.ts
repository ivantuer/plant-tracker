// End-to-end encrypted household sync. Pure functions (no DOM, no UI state) so they can be tested in Node.
// The server holds one encrypted blob per household and never sees the key; the key travels only in the invite link's # part.
import { canon, mergeData, prune } from './merge';
import type { SyncData } from './types';

export { canon, mergeData, prune };

/** What a device keeps after joining: where the household lives, how to authenticate, and the data key. */
export interface Vault { url: string; path: string; bearer: string; key: string }

/** The server no longer accepts this device's credentials for the household. */
export class SyncAuthError extends Error {}

const te = new TextEncoder();
const td = new TextDecoder();
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
/** Chunked: spreading a large array into fromCharCode overflows the call stack. */
export const b64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (s: string) => btoa(String.fromCharCode(...te.encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => td.decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
const base = (url: string) => url.replace(/\/+$/, '');

/** A brand-new household with random credentials. */
export function newVault(url: string): Vault {
  const r = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  return { url: base(url), path: `/v/${hex(r(16))}`, bearer: hex(r(32)), key: b64(r(32)) };
}

const aes = (raw: string) => crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function encrypt(v: Vault, data: SyncData): Promise<{ iv: string; blob: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(v.key), te.encode(JSON.stringify(data))));
  return { iv: b64(iv), blob: b64(ct) };
}

export async function decrypt(v: Vault, iv: string, blob: string): Promise<SyncData> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aes(v.key), unb64(blob));
    const d = JSON.parse(td.decode(pt)) as Partial<SyncData>;
    return { plants: d.plants ?? [], milestones: d.milestones ?? [], photos: d.photos ?? [], tasks: d.tasks ?? [], logs: d.logs ?? [], tombstones: d.tombstones ?? {} };
  } catch {
    throw new Error('Could not decrypt the synced data');
  }
}

// ---- photos ----------------------------------------------------------------------------------------------
// Full-size photos are encrypted with the household key on the phone (12-byte IV, then ciphertext) before they are uploaded.

export async function encryptBytes(v: Vault, bytes: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(v.key), bytes as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decryptBytes(v: Vault, data: Uint8Array): Promise<Uint8Array> {
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, await aes(v.key), data.slice(12)));
  } catch {
    throw new Error('Could not decrypt the photo');
  }
}

export const newPhotoId = () => hex(crypto.getRandomValues(new Uint8Array(16)));

export async function uploadPhoto(v: Vault, id: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch(`${v.url}${v.path}/photo/${id}`, { method: 'PUT', headers: { Authorization: `Bearer ${v.bearer}` }, body: (await encryptBytes(v, bytes)) as BodyInit });
  if (res.status === 401) throw denied();
  if (res.status === 413) throw new Error('too large');
  if (res.status === 403) throw new Error('too many photos');
  if (!res.ok) throw new Error(`Sync server error ${res.status}`);
}

/** The decrypted photo, or null if the server does not have it. */
export async function downloadPhoto(v: Vault, id: string): Promise<Uint8Array | null> {
  const res = await fetch(`${v.url}${v.path}/photo/${id}`, { headers: { Authorization: `Bearer ${v.bearer}` } });
  if (res.status === 404) return null;
  if (res.status === 401) throw denied();
  if (!res.ok) throw new Error(`Sync server error ${res.status}`);
  return decryptBytes(v, new Uint8Array(await res.arrayBuffer()));
}

export async function deletePhoto(v: Vault, id: string): Promise<void> {
  await fetch(`${v.url}${v.path}/photo/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${v.bearer}` } }).catch(() => {});
}

// ---- invites ---------------------------------------------------------------------------------------------
// An invite link works once. The household credentials are sealed under a random key that lives only in the link's #
// part; the server holds the sealed copy and hands it out to the first person who asks, then forgets it.

interface InviteParts { u: string; p: string; c: string; w: string }

/** Seals the credentials, stores them on the server, and returns the code to put after `#join=`. */
export async function createInvite(v: Vault): Promise<string> {
  const r = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const code = hex(r(16));
  const wrap = b64(r(32));
  const iv = r(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(wrap), te.encode(JSON.stringify({ b: v.bearer, k: v.key }))));
  const res = await fetch(`${v.url}${v.path}/invite`, { method: 'POST', headers: headers(v), body: JSON.stringify({ code, iv: b64(iv), ct: b64(ct) }) });
  if (res.status === 401) throw denied();
  if (res.status === 403) throw new Error('too many open invites');
  if (!res.ok) throw new Error(`Sync server error ${res.status}`);
  return b64url(JSON.stringify({ u: v.url, p: v.path, c: code, w: wrap } satisfies InviteParts));
}

export function parseInvite(text: string): InviteParts {
  const code = text.includes('join=') ? text.slice(text.indexOf('join=') + 5).split(/[&\s]/)[0] : text.trim();
  try {
    const j = JSON.parse(unb64url(code)) as InviteParts;
    if (!/^https?:\/\//.test(j.u) || !/^\/v\/[0-9a-f]{32}$/.test(j.p) || !/^[0-9a-f]{32}$/.test(j.c) || !j.w) throw new Error();
    return { ...j, u: base(j.u) };
  } catch {
    throw new Error('invite');
  }
}

/** Collects the credentials. Throws 'used' if the link was already opened or has expired. */
export async function redeemInvite(text: string): Promise<Vault> {
  const j = parseInvite(text);
  const res = await fetch(`${j.u}${j.p}/invite/${j.c}`);
  if (res.status === 404) throw new Error('used');
  if (!res.ok) throw new Error(`Sync server error ${res.status}`);
  const { iv, ct } = (await res.json()) as { iv: string; ct: string };
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aes(j.w), unb64(ct));
    const s = JSON.parse(td.decode(pt)) as { b: string; k: string };
    return { url: j.u, path: j.p, bearer: s.b, key: s.k };
  } catch {
    throw new Error('invite');
  }
}

// ---- network ---------------------------------------------------------------------------------------------

const headers = (v: Vault) => ({ Authorization: `Bearer ${v.bearer}`, 'Content-Type': 'application/json' });
const denied = () => new SyncAuthError('The server does not accept this device. Leave the household and join again.');

interface Remote { rev: number; iv: string; blob: string }

async function fetchRemote(v: Vault): Promise<Remote | null> {
  const res = await fetch(`${v.url}${v.path}`, { headers: headers(v) });
  if (res.status === 404) return null;
  if (res.status === 401) throw denied();
  if (!res.ok) throw new Error(`Sync server error ${res.status}`);
  return (await res.json()) as Remote;
}

export async function pull(v: Vault): Promise<{ rev: number; data: SyncData } | null> {
  const r = await fetchRemote(v);
  return r ? { rev: r.rev, data: await decrypt(v, r.iv, r.blob) } : null;
}

type PushResult = { ok: true; rev: number } | { ok: false };

export async function push(v: Vault, data: SyncData, ifRev: number): Promise<PushResult> {
  const body = await encrypt(v, data);
  const res = await fetch(`${v.url}${v.path}?ifRev=${ifRev}`, { method: 'PUT', headers: headers(v), body: JSON.stringify(body) });
  if (res.status === 409) return { ok: false };
  if (res.status === 401) throw denied();
  if (!res.ok) throw new Error(`Sync server error ${res.status}`);
  return { ok: true, rev: ((await res.json()) as { rev: number }).rev };
}

/**
 * One full sync: fetch the remote copy, merge it with `local`, and upload if the result differs from the remote.
 * If the other phone uploads in between, the server answers 409 and the whole thing is retried.
 */
export async function syncOnce(v: Vault, local: SyncData): Promise<{ data: SyncData; rev: number; pushed: boolean }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await pull(v);
    const data = remote ? mergeData(local, remote.data) : prune(local);
    if (remote && canon(data) === canon(remote.data)) return { data, rev: remote.rev, pushed: false };
    const res = await push(v, data, remote?.rev ?? 0);
    if (res.ok) return { data, rev: res.rev, pushed: true };
    local = data;
  }
  throw new Error('Sync kept conflicting, try again in a moment');
}

/** WebSocket address for live updates, with the token passed as a subprotocol so it stays out of the URL. */
export const liveUrl = (v: Vault) => `${v.url.replace(/^http/, 'ws')}${v.path}/ws`;
export const liveProtocols = (v: Vault) => [`bearer.${v.bearer}`];
