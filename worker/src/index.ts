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
 *   GET    /v/:id/invite/:code      no auth                            -> { iv, ct } once, then 404
 */
import { DurableObject } from 'cloudflare:workers';
import { sendPush, type PushSub } from './vapid';

export interface Env {
  VAULT: DurableObjectNamespace<Vault>;
  ORIGINS?: string;
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
  VAPID_SUBJECT?: string;
}

const MAX_BODY = 1_000_000;
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

    const m = url.pathname.match(/^\/v\/([0-9a-f]{32})(\/ws|\/push|\/invite|\/invite\/[0-9a-f]{32})?$/);
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
