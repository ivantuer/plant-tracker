import type { Log, Plant, SyncData, Task } from '../src/types';

export const plant = (id: string, over: Partial<Plant> = {}): Plant => ({ id, name: id, emoji: '🪴', color: '#000', updatedAt: '2026-01-01T00:00:00.000Z', ...over });

export const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, name: id, emoji: '💧', color: '#000', group: 'care', every: 1, unit: 'month', lead: 0, plantIds: [], months: [], order: 0, updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

export const log = (id: string, taskId: string, plantId: string, at: string, over: Partial<Log> = {}): Log => ({ id, taskId, plantId, at, updatedAt: at, ...over });

export const data = (over: Partial<SyncData> = {}): SyncData => ({ plants: [], milestones: [], tasks: [], logs: [], tombstones: {}, ...over });
