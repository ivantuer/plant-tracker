// Two phones against a running sync server: `cd worker && npx wrangler dev --local`, then
// SYNC_URL=http://localhost:8787 npm test
import { describe, expect, it } from 'vitest';
import { createInvite, deletePhoto, downloadPhoto, newPhotoId, uploadPhoto, liveProtocols, liveUrl, mergeData, newVault, pull, push, redeemInvite, syncOnce } from '../src/sync-core';
import { data, plant, log, task } from './helpers';

const URL_ = process.env.SYNC_URL;
const d = URL_ ? describe : describe.skip;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

d('sync server', () => {
  it('lets two phones converge, stops strangers, and announces changes live', async () => {
    const vault = newVault(URL_!);
    const stranger = { ...newVault(URL_!), path: vault.path };

    const rex = data({ plants: [plant('p1')], tasks: [task('t')], logs: [log('l1', 't', 'p1', '2026-10-24T10:00:00.000Z')] });
    const first = await syncOnce(vault, rex);
    expect(first).toMatchObject({ rev: 1, pushed: true });

    await expect(pull(stranger)).rejects.toThrow(/does not accept/);
    expect(await push(vault, rex, 0)).toEqual({ ok: false }); // stale revision is refused

    // Phone B listens, phone A logs something, phone B hears about it.
    const got: number[] = [];
    const ws = new WebSocket(liveUrl(vault), liveProtocols(vault));
    await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error('ws failed')); });
    ws.onmessage = (e) => { if (e.data !== 'pong') got.push(JSON.parse(String(e.data)).rev); };
    ws.send('ping');
    await wait(200);

    const a = data({ ...rex, logs: [...rex.logs, log('l2', 't', 'p1', '2026-10-25T08:00:00.000Z', { by: 'Bob' })] });
    const second = await syncOnce(vault, a);
    expect(second.rev).toBe(2);
    await wait(300);
    expect(got).toContain(2);

    const b = await pull(vault);
    expect(b!.data.logs.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
    expect(mergeData(b!.data, rex).logs).toHaveLength(2);
    ws.close();

    // An invite works exactly once and hands over working credentials.
    const code = await createInvite(vault);
    const joined = await redeemInvite(`https://x.example/#join=${code}`);
    expect(joined).toMatchObject({ path: vault.path, bearer: vault.bearer, key: vault.key });
    expect((await pull(joined))!.data.logs).toHaveLength(2);
    await expect(redeemInvite(code)).rejects.toThrow('used');

    const bad = new WebSocket(liveUrl(vault), liveProtocols(stranger));
    const closed = await new Promise<boolean>((res) => { bad.onopen = () => res(false); bad.onerror = () => res(true); bad.onclose = () => res(true); });
    expect(closed).toBe(true);
  });

  it('keeps encrypted photos for the household only', async () => {
    const vault = newVault(URL_!);
    await syncOnce(vault, data({ plants: [plant('p1')] }));
    const id = newPhotoId();
    const bytes = Uint8Array.from({ length: 5000 }, (_, i) => i % 251);
    await uploadPhoto(vault, id, bytes);
    expect(await downloadPhoto(vault, id)).toEqual(bytes);

    // What R2 holds is ciphertext: reading it raw does not give the picture back.
    const raw = new Uint8Array(await (await fetch(`${vault.url}${vault.path}/photo/${id}`, { headers: { Authorization: `Bearer ${vault.bearer}` } })).arrayBuffer());
    expect(raw.length).toBeGreaterThan(bytes.length);
    expect(raw.slice(12, 40)).not.toEqual(bytes.slice(0, 28));

    const stranger = { ...newVault(URL_!), path: vault.path };
    await expect(downloadPhoto(stranger, id)).rejects.toThrow(/does not accept/);
    expect((await fetch(`${vault.url}${vault.path}/photo/${id}`)).status).toBe(401);
    expect(await downloadPhoto({ ...newVault(URL_!), path: `/v/${'0'.repeat(32)}` }, id)).toBeNull(); // another household's files are not reachable

    await deletePhoto(vault, id);
    expect(await downloadPhoto(vault, id)).toBeNull();
  });
});
