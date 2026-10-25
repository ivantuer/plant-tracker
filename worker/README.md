# Sync server

A small Cloudflare Worker with one Durable Object per household. It stores one encrypted blob (it never holds the key), tells connected phones the moment it changes (WebSocket), and sends content-free web pushes at the times the phones registered. Durable Objects with SQLite storage are available on the Workers free plan.

## Deploy (once)

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy                         # prints https://plantcare-sync.<you>.workers.dev
```

Allowed sites: edit `ORIGINS` in `wrangler.toml` to the address where the app is hosted (default `https://ivantuer.github.io`; `http://localhost` is always allowed).

Then put the Worker address in `src/config.ts` (`DEFAULT_SERVER`) and push. Or type it into Settings on each phone.

## Push reminders (once)

```bash
cd ..                                       # app folder
npm run vapid                               # prints a public key and a private key
```

1. Paste the public key into `VAPID_PUBLIC` in `wrangler.toml`, and set `VAPID_SUBJECT` to your own `mailto:` address.
2. `cd worker && npx wrangler secret put VAPID_PRIVATE` and paste the printed JSON line.
3. `npx wrangler deploy`.

## Try it locally

```bash
npx wrangler dev --local                    # http://localhost:8787
```

In the app's Settings, set the server to `http://localhost:8787`.

## API

| | |
|---|---|
| `GET /config` | `{ vapid }` public push key |
| `GET /v/:id` | `Authorization: Bearer <token>` → `{ rev, iv, blob, updatedAt }` or 404 |
| `PUT /v/:id?ifRev=N` | `{ iv, blob }` → `{ rev }` or 409 (compare-and-swap; the first PUT claims the id) |
| `GET /v/:id/ws` | WebSocket, token as subprotocol `bearer.<token>`; sends `{ rev }` after every PUT |
| `POST /v/:id/push` | `{ sub, times }` register a phone and the moments to wake it |
| `DELETE /v/:id/push` | `{ endpoint }` |

The vault id and token are random values created on the first phone and shared in the invite link. Anyone holding the link can read and write the household, so share it only with the person you trust.
