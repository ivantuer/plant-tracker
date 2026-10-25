// Verifies Google ID tokens (the "Continue with Google" button) without any library.
const te = new TextEncoder();
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export interface GoogleEnv {
  GOOGLE_CLIENT_ID?: string;
  /** Override for tests; defaults to Google's published signing keys. */
  GOOGLE_JWKS_URL?: string;
}

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }
let jwksCache: { at: number; url: string; keys: Jwk[] } | null = null;

async function googleKeys(env: GoogleEnv): Promise<Jwk[]> {
  const url = env.GOOGLE_JWKS_URL ?? 'https://www.googleapis.com/oauth2/v3/certs';
  if (jwksCache && jwksCache.url === url && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error('could not load Google signing keys');
  jwksCache = { at: Date.now(), url, keys: ((await res.json()) as { keys: Jwk[] }).keys };
  return jwksCache.keys;
}

export interface GoogleIdentity { sub: string; email: string }

/** Checks signature, audience, issuer, expiry and email_verified. Returns null if anything is off. */
export async function verifyGoogleToken(token: string, env: GoogleEnv): Promise<GoogleIdentity | null> {
  try {
    if (!env.GOOGLE_CLIENT_ID) return null;
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(new TextDecoder().decode(unb64u(h))) as { alg: string; kid: string };
    if (header.alg !== 'RS256') return null;
    const jwk = (await googleKeys(env)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), te.encode(`${h}.${p}`)))) return null;
    const c = JSON.parse(new TextDecoder().decode(unb64u(p))) as { iss: string; aud: string; exp: number; sub: string; email?: string; email_verified?: boolean };
    if (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') return null;
    if (c.aud !== env.GOOGLE_CLIENT_ID) return null;
    if (c.exp * 1000 < Date.now()) return null;
    if (!c.sub || !c.email || c.email_verified !== true) return null;
    return { sub: c.sub, email: c.email.toLowerCase() };
  } catch {
    return null;
  }
}
