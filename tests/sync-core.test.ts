import { describe, expect, it } from 'vitest';
import { canon, decrypt, encrypt, mergeData, newVault, parseInvite } from '../src/sync-core';
import { data, plant, log, task } from './helpers';

const T = (n: number) => `2026-10-2${n}T10:00:00.000Z`;

describe('merge', () => {
  it('keeps what each phone added', () => {
    const a = data({ plants: [plant('p1')], tasks: [task('t')], logs: [log('l1', 't', 'p1', T(1))] });
    const b = data({ plants: [plant('p1')], tasks: [task('t')], logs: [log('l2', 't', 'p1', T(2), { by: 'Bob' })] });
    expect(mergeData(a, b).logs.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
  });

  it('is the same whichever phone merges first, and merging twice changes nothing', () => {
    const a = data({ plants: [plant('p1', { name: 'Монті', updatedAt: T(1) })], tasks: [task('t', { name: 'A', updatedAt: T(1) })], logs: [log('l1', 't', 'p1', T(1))] });
    const b = data({ plants: [plant('p1', { name: 'Monty2', updatedAt: T(2) })], tasks: [task('t', { name: 'B', updatedAt: T(2) })], logs: [log('l2', 't', 'p1', T(2))], tombstones: { l1: T(3) } });
    const ab = mergeData(a, b), ba = mergeData(b, a);
    expect(canon(ab)).toBe(canon(ba));
    expect(canon(mergeData(ab, b))).toBe(canon(ab));
    expect(ab.plants[0].name).toBe('Monty2');
    expect(ab.logs.map((l) => l.id)).toEqual(['l2']);
  });

  it('lets an edit made after a delete win, and a delete after an edit win', () => {
    const edited = data({ plants: [plant('p1')], tasks: [task('t')], logs: [log('l', 't', 'p1', T(1), { note: 'edited', updatedAt: T(5) })] });
    expect(mergeData(edited, data({ tombstones: { l: T(3) } })).logs).toHaveLength(1);
    expect(mergeData(edited, data({ tombstones: { l: T(6) } })).logs).toHaveLength(0);
  });

  it('drops entries whose plant or routine was deleted', () => {
    const a = data({ plants: [plant('p1')], tasks: [task('t')], logs: [log('l', 't', 'p1', T(1))] });
    expect(mergeData(a, data({ tombstones: { p1: T(2) } })).logs).toHaveLength(0);
    expect(mergeData(a, data({ tombstones: { t: T(2) } })).logs).toHaveLength(0);
  });
});

describe('encryption and invites', () => {
  it('round-trips and rejects the wrong key', async () => {
    const v = newVault('https://x.example');
    const d = data({ plants: [plant('p1', { name: 'Монті 🌿' })] });
    const { iv, blob } = await encrypt(v, d);
    expect(blob).not.toContain('Монті');
    expect((await decrypt(v, iv, blob)).plants[0].name).toBe('Монті 🌿');
    await expect(decrypt(newVault('https://x.example'), iv, blob)).rejects.toThrow();
  });

  it('rejects garbage as an invite', () => {
    expect(() => parseInvite('https://me.github.io/plants/#join=garbage')).toThrow('invite');
    expect(() => parseInvite('')).toThrow('invite');
  });
});
