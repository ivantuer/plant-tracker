import { describe, expect, it } from 'vitest';
import { canon, mergeData, prune } from '../src/merge';
import { data, log, plant, task } from './helpers';

const later = '2026-06-01T00:00:00.000Z';

describe('merge', () => {
  const a = data({ plants: [plant('p1', { name: 'old' })], tasks: [task('t1')], logs: [log('l1', 't1', 'p1', '2026-02-01T10:00:00.000Z')] });
  const b = data({ plants: [plant('p1', { name: 'new', updatedAt: later }), plant('p2')], tasks: [task('t1')] });

  it('is commutative and idempotent', () => {
    expect(canon(mergeData(a, b))).toBe(canon(mergeData(b, a)));
    expect(canon(mergeData(a, a))).toBe(canon(a));
    expect(mergeData(a, b).plants.find((p) => p.id === 'p1')!.name).toBe('new');
  });

  it('a deletion beats an older record but not a newer edit', () => {
    const gone = data({ tombstones: { p1: '2026-03-01T00:00:00.000Z' } });
    expect(mergeData(a, gone).plants.map((p) => p.id)).toEqual([]);
    expect(mergeData(b, gone).plants.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('merges photo records and drops them with their plant', () => {
    const ph = (id: string, plantId: string) => ({ id, plantId, thumbId: id + 't', day: '2026-05-01', updatedAt: later });
    const x = data({ plants: [plant('p1')], photos: [ph('a', 'p1')] });
    const y = data({ plants: [plant('p1'), plant('p2')], photos: [ph('b', 'p2')] });
    expect(mergeData(x, y).photos.map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(canon(mergeData(x, y))).toBe(canon(mergeData(y, x)));
    expect(mergeData(x, data({ tombstones: { a: '2026-07-01T00:00:00.000Z' } })).photos).toEqual([]);
    expect(mergeData(y, data({ tombstones: { p2: '2026-07-01T00:00:00.000Z' } })).photos).toEqual([]);
  });

  it('removing a plant drops its history and routines kept only for it', () => {
    const d = data({
      plants: [plant('p2')],
      tasks: [task('only1', { plantIds: ['p1'] }), task('shared', { plantIds: ['p1', 'p2'] }), task('all')],
      milestones: [{ id: 'm', plantId: 'p1', kind: 'bloom', day: '2026-05-01', updatedAt: later }],
      logs: [log('l', 'only1', 'p1', later), log('l2', 'all', 'p2', later)],
    });
    const p = prune(d);
    expect(p.tasks.map((t) => t.id)).toEqual(['shared', 'all']);
    expect(p.tasks[0].plantIds).toEqual(['p2']);
    expect(p.milestones).toEqual([]);
    expect(p.logs.map((l) => l.id)).toEqual(['l2']);
  });
});
