// Google sign-in against a running server whose Google keys point at this test (it signs its own tokens):
//   cd worker && npx wrangler dev --local --port 8799 --var GOOGLE_JWKS_URL:http://localhost:8798/jwks --var GOOGLE_CLIENT_ID:test-client
//   SYNC_URL=http://localhost:8799 JWKS_PORT=8798 npm test
import { createServer } from 'node:http';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { newVault, syncOnce } from '../src/sync-core';
import { data, log, plant, task } from './helpers';

const URL_ = process.env.SYNC_URL;
const PORT = Number(process.env.JWKS_PORT);
const d = URL_ && PORT ? describe : describe.skip;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64u = (x: string | Buffer) => Buffer.from(x).toString('base64url');
const token = (sub: string, email: string, over: Record<string, unknown> = {}) => {
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
  const body = b64u(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'test-client', exp: Math.floor(Date.now() / 1000) + 600, sub, email, email_verified: true, ...over }));
  return `${head}.${body}.${createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url')}`;
};
const post = (path: string, body: unknown) => fetch(`${URL_}${path}`, { method: 'POST', body: JSON.stringify(body) });

d('sign in with Google', () => {
  it('opens the same household on a second device, shares it by email, and refuses strangers and forged tokens', async () => {
    const srv = createServer((_, res) => res.end(JSON.stringify({ keys: [jwk] }))).listen(PORT);
    try {
      const anna = token('sub-anna', 'anna@example.com');
      expect((await post('/google/open', { idToken: anna })).status).toBe(404); // nothing linked yet

      // First device: new household, then link it to the Google account.
      const v = newVault(URL_!);
      await syncOnce(v, data({ plants: [plant('p1')], tasks: [task('t')], logs: [log('l', 't', 'p1', '2026-10-24T10:00:00.000Z')] }));
      const creds = { path: v.path, bearer: v.bearer, key: v.key };
      expect((await post('/google/link', { idToken: anna, ...creds, bearer: 'f'.repeat(64) })).status).toBe(401); // must hold the household
      expect((await post('/google/link', { idToken: anna, ...creds })).status).toBe(200);

      // Second device, same Google account: gets the same household.
      const opened = await (await post('/google/open', { idToken: token('sub-anna', 'anna@example.com') })).json();
      expect(opened).toMatchObject({ ...creds, email: 'anna@example.com' });

      // Another account is refused until the household is shared with its email.
      const bob = token('sub-bob', 'bob@example.com');
      expect((await post('/google/open', { idToken: bob })).status).toBe(403);
      expect((await post('/google/share', { ...creds, bearer: 'e'.repeat(64), email: 'bob@example.com' })).status).toBe(401);
      expect((await post('/google/share', { ...creds, email: 'Bob@Example.com' })).status).toBe(200);
      expect(await (await post('/google/open', { idToken: bob })).json()).toMatchObject(creds);
      expect(await (await post('/google/open', { idToken: bob })).json()).toMatchObject(creds); // and keeps working afterwards
      expect((await post('/google/open', { idToken: token('sub-eve', 'eve@example.com') })).status).toBe(403);

      // Tokens that are expired, for another app, unverified, or forged are rejected.
      for (const bad of [token('sub-anna', 'anna@example.com', { exp: 1 }), token('sub-anna', 'anna@example.com', { aud: 'other' }), token('sub-anna', 'anna@example.com', { email_verified: false }), `${anna.slice(0, -4)}AAAA`]) {
        expect((await post('/google/open', { idToken: bad })).status).toBe(401);
      }
    } finally {
      srv.close();
    }
  });
});
