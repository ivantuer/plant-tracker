/**
 * Sync server for Plant Care. One Durable Object per household stores one encrypted blob (the key never reaches it),
 * announces changes over a WebSocket, and sends content-free web pushes at the times the phones asked for.
 *
 *   GET    /config                  -> { vapid }                       public push key
 *   GET    /v/:id                   Authorization: Bearer <token>      -> { rev, iv, blob, updatedAt } | 404
 *   PUT    /v/:id?ifRev=N           { iv, blob }                       -> { rev } | 409 { error: 'conflict' }  (first PUT claims the id)
 *   GET    /v/:id/ws                Sec-WebSocket-Protocol: bearer.<token>   -> pushes { rev } after every PUT
 *   POST   /v/:id/push              { sub, times }                     register a phone and the moments to wake it
 *   DELETE /v/:id/push              { endpoint }                       unregister
 *   POST   /v/:id/invite            { code, iv, ct }                   store a sealed single-use invite (7 days)
 *   PUT/GET/DELETE /v/:id/photo/:pid  encrypted photo bytes (R2), up to 3 MB each, 600 files per household
 *   GET    /v/:id/invite/:code      no auth                            -> { iv, ct } once, then 404
 *
 * Sign-in with Google, so no device needs an address or an invite:
 *   POST   /google/open             { idToken }                        -> { path, bearer, key, email } | 404 (nothing linked yet)
 *   POST   /google/link             { idToken, path, bearer, key }     keep this household for the Google account (needs the household token)
 *   POST   /google/share            { path, bearer, key, email }       let another Google account open the same household
 * While linked, the household credentials are kept sealed with a key that lives only in this server's storage.
 */
import { DurableObject } from 'cloudflare:workers';
import { verifyGoogleToken } from './google';
import { sendPush, type PushSub } from './vapid';

export interface Env {
  VAULT: DurableObjectNamespace<Vault>;
  PHOTOS: R2Bucket;
  DIRECTORY: DurableObjectNamespace<Directory>;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_JWKS_URL?: string;
  ORIGINS?: string;
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
  VAPID_SUBJECT?: string;
}

const MAX_BODY = 1_000_000;
const MAX_PHOTO = 3_000_000;
/** Each photo is two files (full size and a thumbnail). */
const MAX_PHOTOS = 600;
const MAX_SUBS = 8;
const MAX_INVITES = 5;
const INVITE_TTL = 7 * 86_400_000;
const MAX_TIMES = 64;
const te = new TextEncoder();

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', te.encode(text)));

/** Constant-time string compare. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const cors = (req: Request, env: Env): Record<string, string> => {
  const origins = (env.ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const o = req.headers.get('Origin') ?? '';
  const ok = origins.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    'Access-Control-Allow-Origin': ok ? o : (origins[0] ?? 'null'),
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Invite { iv: string; ct: string; exp: number }
interface SubRec { sub: PushSub; times: number[]; fails: number }

// ---- one household ---------------------------------------------------------------------------------------

interface Rec { auth: string; rev: number; updatedAt: string; iv: string; blob: string }

export class Vault extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Answered by the runtime without waking the object, so idle sockets cost nothing.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const auth = req.headers.get('X-Auth') ?? '';

    // Redeeming an invite needs no token (the code is the secret) and works exactly once.
    const redeem = url.pathname.match(/\/invite\/([0-9a-f]{32})$/);
    if (redeem && req.method === 'GET') {
      const invites = (await this.ctx.storage.get<Record<string, Invite>>('invites')) ?? {};
      const inv = invites[redeem[1]];
      if (!inv || inv.exp < Date.now()) return json({ error: 'used' }, 404);
      delete invites[redeem[1]];
      await this.ctx.storage.put('invites', invites);
      return json({ iv: inv.iv, ct: inv.ct });
    }

    const rec = await this.ctx.storage.get<Rec>('vault');
    if (rec && !same(rec.auth, auth)) return json({ error: 'not authorized for this vault' }, 401);

    if (url.pathname.endsWith('/ws')) {
      if (!rec) return json({ error: 'empty' }, 404);
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      const proto = (req.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((x) => x.trim()).find((x) => x.startsWith('bearer.'));
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0], headers: proto ? { 'Sec-WebSocket-Protocol': proto } : {} });
    }

    const photo = url.pathname.match(/^\/v\/([0-9a-f]{32})\/photo\/([0-9a-f]{32})$/);
    if (photo) return this.photo(req, rec, `${photo[1]}/${photo[2]}`);

    if (url.pathname.endsWith('/push')) return this.push(req, rec);
    if (url.pathname.endsWith('/invite') && req.method === 'POST') return this.invite(req, rec);

    if (req.method === 'GET') {
      if (!rec) return json({ error: 'empty' }, 404);
      return json({ rev: rec.rev, iv: rec.iv, blob: rec.blob, updatedAt: rec.updatedAt });
    }

    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
      let body: { iv?: unknown; blob?: unknown };
      try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
      if (typeof body.iv !== 'string' || typeof body.blob !== 'string') return json({ error: 'bad body' }, 400);
      const ifRev = Number(url.searchParams.get('ifRev') ?? '0');
      if ((rec?.rev ?? 0) !== ifRev) return json({ error: 'conflict', rev: rec?.rev ?? 0 }, 409);
      const next: Rec = { auth: rec?.auth ?? auth, rev: ifRev + 1, updatedAt: new Date().toISOString(), iv: body.iv, blob: body.blob };
      await this.ctx.storage.put('vault', next);
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(JSON.stringify({ rev: next.rev })); } catch { /* a dead socket is cleaned up by the runtime */ }
      }
      return json({ rev: next.rev });
    }

    return json({ error: 'method not allowed' }, 405);
  }

  /** Keeps a sealed copy of the household credentials for one person to collect. The key to open it is never sent here. */
  private async invite(req: Request, rec: Rec | undefined): Promise<Response> {
    if (!rec) return json({ error: 'empty' }, 404);
    let body: { code?: unknown; iv?: unknown; ct?: unknown };
    try { body = JSON.parse(await req.text()); } catch { return json({ error: 'bad json' }, 400); }
    if (typeof body.code !== 'string' || !/^[0-9a-f]{32}$/.test(body.code) || typeof body.iv !== 'string' || typeof body.ct !== 'string' || body.ct.length > 2000) return json({ error: 'bad body' }, 400);
    const now = Date.now();
    const invites = Object.fromEntries(Object.entries((await this.ctx.storage.get<Record<string, Invite>>('invites')) ?? {}).filter(([, v]) => v.exp > now));
    if (Object.keys(invites).length >= MAX_INVITES) return json({ error: 'too many open invites' }, 403);
    invites[body.code] = { iv: body.iv, ct: body.ct, exp: now + INVITE_TTL };
    await this.ctx.storage.put('invites', invites);
    return json({ ok: true });
  }

  /** Encrypted photo bytes in R2, under this household's prefix. The server cannot read them. */
  private async photo(req: Request, rec: Rec | undefined, key: string): Promise<Response> {
    if (!rec) return json({ error: 'empty' }, 404);
    if (req.method === 'GET') {
      const obj = await this.env.PHOTOS.get(key);
      if (!obj) return json({ error: 'not found' }, 404);
      return new Response(obj.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable' } });
    }
    if (req.method === 'DELETE') {
      await this.env.PHOTOS.delete(key);
      return json({ ok: true });
    }
    if (req.method === 'PUT') {
      if (Number(req.headers.get('Content-Length') ?? '0') > MAX_PHOTO) return json({ error: 'too large' }, 413);
      const bytes = await req.arrayBuffer();
      if (bytes.byteLength > MAX_PHOTO) return json({ error: 'too large' }, 413);
      if (bytes.byteLength < 28) return json({ error: 'bad body' }, 400);
      const mine = await this.env.PHOTOS.list({ prefix: `${key.split('/')[0]}/`, limit: MAX_PHOTOS + 1 });
      if (mine.objects.length >= MAX_PHOTOS && !mine.objects.some((o) => o.key === key)) return json({ error: 'too many photos' }, 403);
      await this.env.PHOTOS.put(key, bytes);
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  }

  private async push(req: Request, rec: Rec | undefined): Promise<Response> {
    if (!rec) return json({ error: 'empty' }, 404);
    let body: { sub?: PushSub; times?: unknown; endpoint?: unknown };
    try { body = JSON.parse(await req.text()); } catch { return json({ error: 'bad json' }, 400); }
    const subs = (await this.ctx.storage.get<Record<string, SubRec>>('subs')) ?? {};

    if (req.method === 'DELETE') {
      if (typeof body.endpoint === 'string') delete subs[body.endpoint];
    } else if (req.method === 'POST') {
      const sub = body.sub;
      if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) return json({ error: 'bad subscription' }, 400);
      if (!Array.isArray(body.times) || body.times.some((t) => typeof t !== 'number')) return json({ error: 'bad times' }, 400);
      if (!subs[sub.endpoint] && Object.keys(subs).length >= MAX_SUBS) return json({ error: 'too many devices' }, 403);
      subs[sub.endpoint] = { sub: { endpoint: sub.endpoint, keys: sub.keys }, times: (body.times as number[]).slice(0, MAX_TIMES), fails: 0 };
    } else {
      return json({ error: 'method not allowed' }, 405);
    }
    await this.ctx.storage.put('subs', subs);
    await this.arm(subs);
    return json({ ok: true });
  }

  /** Sets the alarm for the earliest moment any phone wants waking. Overdue leftovers (failed sends) are retried in 10 minutes. */
  private async arm(subs: Record<string, SubRec>) {
    const now = Date.now();
    let next = Infinity;
    for (const s of Object.values(subs)) for (const t of s.times) next = Math.min(next, t > now ? t : now + 600_000);
    if (next === Infinity) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
  }

  async alarm() {
    const subs = (await this.ctx.storage.get<Record<string, SubRec>>('subs')) ?? {};
    const now = Date.now();
    for (const [endpoint, s] of Object.entries(subs)) {
      if (!s.times.some((t) => t <= now)) continue;
      const res = await sendPush(this.env, s.sub).catch(() => null);
      if (res && (res.status === 404 || res.status === 410)) { delete subs[endpoint]; continue; } // the phone unsubscribed
      if (res?.ok) s.fails = 0;
      else if (++s.fails < 5) continue; // keep the due times so the next alarm retries
      else s.fails = 0; // give up on this round
      s.times = s.times.filter((t) => t > now);
    }
    await this.ctx.storage.put('subs', subs);
    await this.arm(subs);
  }

  // Messages from phones are only keep-alives (handled by the auto-response); nothing else to do.
  webSocketMessage() {}
  webSocketClose(ws: WebSocket) { try { ws.close(); } catch { /* already closed */ } }
}

// ---- Google accounts -------------------------------------------------------------------------------------

interface Creds { path: string; bearer: string; key: string }
interface Sealed { iv: string; ct: string; email: string }

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * One object for the whole server: which Google account owns which household. The first account to link becomes the
 * owner; others can open only a household that was shared with their email. Credentials are sealed with a key kept here.
 */
export class Directory extends DurableObject<Env> {
  private async sealKey(): Promise<CryptoKey> {
    let raw = await this.ctx.storage.get<string>('sealKey');
    if (!raw) { raw = b64(crypto.getRandomValues(new Uint8Array(32))); await this.ctx.storage.put('sealKey', raw); }
    return crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  private async seal(c: Creds, email: string): Promise<Sealed> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await this.sealKey(), te.encode(JSON.stringify(c)));
    return { iv: b64(iv), ct: b64(ct), email };
  }
  private async unseal(s: Sealed): Promise<Creds> {
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, await this.sealKey(), unb64(s.ct)))) as Creds;
  }

  async fetch(req: Request): Promise<Response> {
    const op = new URL(req.url).pathname.split('/').pop();
    const body = (await req.json()) as { sub?: string; email?: string; creds?: Creds; to?: string };
    const st = this.ctx.storage;
    const links = (await st.get<Record<string, Sealed>>('links')) ?? {};
    const pending = (await st.get<Record<string, Sealed>>('pending')) ?? {};
    const owner = await st.get<string>('owner');

    if (op === 'open') {
      const { sub, email } = body as { sub: string; email: string };
      let rec = links[sub];
      if (!rec && pending[email]) {
        rec = links[sub] = { ...pending[email], email };
        delete pending[email];
        await st.put('links', links);
        await st.put('pending', pending);
      }
      if (rec) return json({ ...(await this.unseal(rec)), email });
      return owner && owner !== sub ? json({ error: 'This server belongs to another Google account' }, 403) : json({ error: 'nothing linked yet' }, 404);
    }

    if (op === 'link') {
      const { sub, email, creds } = body as { sub: string; email: string; creds: Creds };
      if (owner && owner !== sub) return json({ error: 'This server belongs to another Google account' }, 403);
      if (!owner) await st.put('owner', sub);
      links[sub] = await this.seal(creds, email);
      await st.put('links', links);
      return json({ ok: true, email });
    }

    if (op === 'share') {
      const { creds, to } = body as { creds: Creds; to: string };
      if (Object.keys(pending).length >= 10 && !pending[to]) return json({ error: 'too many pending shares' }, 403);
      pending[to] = await this.seal(creds, to);
      await st.put('pending', pending);
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }
}

async function google(req: Request, env: Env, op: string): Promise<Response> {
  let body: { idToken?: string; path?: string; bearer?: string; key?: string; email?: string };
  try { body = JSON.parse(await req.text()); } catch { return json({ error: 'bad json' }, 400); }
  const dir = env.DIRECTORY.get(env.DIRECTORY.idFromName('directory'));
  const call = (path: string, payload: unknown) => dir.fetch(`https://directory/${path}`, { method: 'POST', body: JSON.stringify(payload) });

  const creds: Creds | null =
    typeof body.path === 'string' && /^\/v\/[0-9a-f]{32}$/.test(body.path) && /^[0-9a-f]{64}$/.test(body.bearer ?? '') && typeof body.key === 'string' && body.key.length < 100
      ? { path: body.path, bearer: body.bearer!, key: body.key } : null;
  /** The caller must hold the household's token before the server keeps or hands out a copy of it. */
  const holds = async (c: Creds) => {
    const res = await env.VAULT.get(env.VAULT.idFromName(c.path.slice(3))).fetch(new Request('https://vault/', { headers: { 'X-Auth': await sha256(c.bearer) } }));
    return res.status === 200;
  };

  if (op === 'share') {
    const to = (body.email ?? '').trim().toLowerCase();
    if (!creds || !(await holds(creds))) return json({ error: 'not authorized for this household' }, 401);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 200) return json({ error: 'bad email' }, 400);
    return call('share', { creds, to });
  }

  const who = body.idToken ? await verifyGoogleToken(body.idToken, env) : null;
  if (!who) return json({ error: 'Google sign-in could not be verified' }, 401);
  if (op === 'open') return call('open', { sub: who.sub, email: who.email });
  if (op === 'link') {
    if (!creds || !(await holds(creds))) return json({ error: 'not authorized for this household' }, 401);
    return call('link', { sub: who.sub, email: who.email, creds });
  }
  return json({ error: 'not found' }, 404);
}

// ---- router ----------------------------------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(req.url);

    const reply = (r: Response) => {
      if (r.status === 101) return r;
      const out = new Response(r.body, r);
      for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
      return out;
    };

    if (url.pathname === '/config') return reply(json({ vapid: env.VAPID_PUBLIC || null }));

    const g = url.pathname.match(/^\/google\/(open|link|share)$/);
    if (g && req.method === 'POST') return reply(await google(req, env, g[1]));

    const m = url.pathname.match(/^\/v\/([0-9a-f]{32})(\/ws|\/push|\/invite|\/invite\/[0-9a-f]{32}|\/photo\/[0-9a-f]{32})?$/);
    if (!m) return reply(json({ error: 'not found' }, 404));
    const proto = (req.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((x) => x.trim()).find((x) => x.startsWith('bearer.'));
    const token = proto ? proto.slice(7) : (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const redeeming = req.method === 'GET' && /\/invite\/[0-9a-f]{32}$/.test(url.pathname);
    if (!redeeming && !/^[0-9a-f]{64}$/.test(token)) return reply(json({ error: 'bad auth' }, 401));

    const forward = new Request(req);
    forward.headers.set('X-Auth', redeeming ? '' : await sha256(token));
    return reply(await env.VAULT.get(env.VAULT.idFromName(m[1])).fetch(forward));
  },
};
