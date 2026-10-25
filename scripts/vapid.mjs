// Prints a fresh VAPID key pair for web push. Run once: `npm run vapid`.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' });
const pub = publicKey.export({ format: 'jwk' });
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');

console.log('1) Put this in worker/wrangler.toml under [vars]:\n');
console.log(`VAPID_PUBLIC = "${raw}"\n`);
console.log('2) Store this as a secret (paste the whole line when asked):\n');
console.log('   cd worker && npx wrangler secret put VAPID_PRIVATE\n');
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }));
