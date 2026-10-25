// Merging two copies of the data (a backup import now, a second device later). Commutative and idempotent.
import type { SyncData } from './types';

/** The newer record wins; on a tie the larger JSON wins, so every merge picks the same one. */
function newer<T extends { updatedAt: string }>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function byId<T extends { id: string; updatedAt: string }>(a: T[], b: T[]): T[] {
  const out = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const cur = out.get(x.id);
    out.set(x.id, cur ? newer(cur, x) : x);
  }
  return [...out.values()];
}

/** Drops anything whose plant or task is gone; a task kept only for deleted plants goes too. */
export function prune(d: SyncData): SyncData {
  const plants = new Set(d.plants.map((x) => x.id));
  const tasks = d.tasks.filter((t) => t.plantIds.length === 0 || t.plantIds.some((id) => plants.has(id)));
  const ids = new Set(tasks.map((x) => x.id));
  return {
    ...d,
    tasks: tasks.map((t) => (t.plantIds.length && t.plantIds.some((id) => !plants.has(id)) ? { ...t, plantIds: t.plantIds.filter((id) => plants.has(id)) } : t)),
    milestones: d.milestones.filter((m) => plants.has(m.plantId)),
    photos: (d.photos ?? []).filter((p) => plants.has(p.plantId)),
    logs: d.logs.filter((l) => plants.has(l.plantId) && ids.has(l.taskId)),
  };
}

export function mergeData(a: SyncData, b: SyncData): SyncData {
  const tombstones: Record<string, string> = { ...a.tombstones };
  for (const [id, at] of Object.entries(b.tombstones)) if (!tombstones[id] || at > tombstones[id]) tombstones[id] = at;
  // A deletion beats a record unless the record was edited after it was deleted.
  const alive = <T extends { id: string; updatedAt: string }>(x: T) => !tombstones[x.id] || x.updatedAt > tombstones[x.id];
  return prune({
    plants: byId(a.plants, b.plants).filter(alive),
    milestones: byId(a.milestones, b.milestones).filter(alive),
    photos: byId(a.photos ?? [], b.photos ?? []).filter(alive),
    tasks: byId(a.tasks, b.tasks).filter(alive),
    logs: byId(a.logs, b.logs).filter(alive),
    tombstones,
  });
}

/** Stable form for comparing two datasets regardless of ordering. */
export function canon(d: SyncData): string {
  const sortBy = <T extends { id: string }>(xs: T[]) => [...xs].sort((p, q) => p.id.localeCompare(q.id));
  return JSON.stringify({ p: sortBy(d.plants), m: sortBy(d.milestones), f: sortBy(d.photos ?? []), t: sortBy(d.tasks), l: sortBy(d.logs), x: Object.entries(d.tombstones).sort() });
}
