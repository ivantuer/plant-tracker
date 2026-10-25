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
