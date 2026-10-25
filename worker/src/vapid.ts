// Web push with VAPID and no payload: the phone's service worker reads its own copy of the data to write the message.
const te = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export interface PushSub { endpoint: string; keys?: { p256dh?: string; auth?: string } }
export interface VapidEnv { VAPID_PUBLIC?: string; VAPID_PRIVATE?: string; VAPID_SUBJECT?: string }

export async function sendPush(env: VapidEnv, sub: PushSub): Promise<Response> {
  if (!env.VAPID_PRIVATE || !env.VAPID_PUBLIC) throw new Error('push keys are not configured');
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const aud = new URL(sub.endpoint).origin;
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT ?? 'mailto:you@example.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${head}.${body}`));
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`, TTL: '86400', Urgency: 'normal' },
  });
}
