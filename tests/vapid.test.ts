import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { sendPush } from '../worker/src/vapid';

describe('web push signing', () => {
  it('sends an empty POST whose VAPID token verifies against the public key', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = privateKey.export({ format: 'jwk' });
    const pub = publicKey.export({ format: 'jwk' });
    const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, 'base64url'), Buffer.from(pub.y!, 'base64url')]).toString('base64url');

    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await sendPush({ VAPID_PUBLIC: raw, VAPID_PRIVATE: JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }), VAPID_SUBJECT: 'mailto:a@b.c' }, { endpoint: 'https://push.example.com/send/abc' });
    expect(res.status).toBe(201);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://push.example.com/send/abc');
    expect(init.body).toBeUndefined();
    const m = init.headers.Authorization.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/)!;
    expect(m[4]).toBe(raw);
    const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
    expect(claims).toMatchObject({ aud: 'https://push.example.com', sub: 'mailto:a@b.c' });
    const ok = verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url'));
    expect(ok).toBe(true);
    vi.unstubAllGlobals();
  });
});
