import type { Plant, Task } from './types';
import type { Species } from './species';
import { DORMANT, GROWING } from './species';

export interface Preset {
  key: string;
  group: 'care' | 'pest';
  emoji: string;
  color: string;
  every: number;
  unit: Task['unit'];
  lead: number;
  months?: number[];
  /** Applies only to this plant when added from the species guide, instead of every plant. */
  limit?: number;
}

const HEATING = [10, 11, 12, 1, 2, 3, 4];
const WARM = [3, 4, 5, 6, 7, 8, 9, 10];

/** Care and pest-prevention routines the user can add with one tap. Names live in the i18n dictionaries as `preset.<key>`. */
export const PRESETS: Preset[] = [
  { key: 'water', group: 'care', emoji: '💧', color: '#4a90d9', every: 7, unit: 'day', lead: 0 },
  { key: 'feed', group: 'care', emoji: '🧪', color: '#7bc043', every: 2, unit: 'week', lead: 1, months: GROWING },
  { key: 'mist', group: 'care', emoji: '🌫️', color: '#2bb3a0', every: 3, unit: 'day', lead: 0 },
  { key: 'rotate', group: 'care', emoji: '🔄', color: '#8b6fd6', every: 1, unit: 'week', lead: 0 },
  { key: 'wipe', group: 'care', emoji: '🧽', color: '#2bb3a0', every: 1, unit: 'month', lead: 2 },
  { key: 'repot', group: 'care', emoji: '🪴', color: '#e0a526', every: 1, unit: 'year', lead: 14, months: [3, 4, 5] },
  { key: 'check', group: 'pest', emoji: '🔍', color: '#e0605c', every: 2, unit: 'week', lead: 0 },
  { key: 'shower', group: 'pest', emoji: '🚿', color: '#4a90d9', every: 1, unit: 'month', lead: 2 },
  { key: 'mite', group: 'pest', emoji: '🕸️', color: '#d66aa8', every: 2, unit: 'week', lead: 1, months: HEATING },
  { key: 'bio', group: 'pest', emoji: '🛡️', color: '#e0605c', every: 2, unit: 'month', lead: 3, months: WARM },
  { key: 'traps', group: 'pest', emoji: '🟡', color: '#e0a526', every: 1, unit: 'month', lead: 2 },
];

/** The pest-prevention plan Ukrainian growers usually follow: inspect, wash the leaves, humidity in winter, a bio treatment in spring and autumn, fresh sticky traps. */
export const PEST_PLAN = ['check', 'shower', 'mite', 'bio', 'traps'];

export const presetByKey = (key: string) => PRESETS.find((p) => p.key === key);

export type TaskDraft = Omit<Task, 'updatedAt'>;

export function draftFromPreset(p: Preset, name: string, order: number, id: string, plantIds: string[] = []): TaskDraft {
  return { id, name, emoji: p.emoji, color: p.color, group: p.group, every: p.every, unit: p.unit, lead: p.lead, plantIds, months: p.months ?? [], preset: p.key, order, ...(p.limit ? { limit: p.limit } : {}) };
}

/** Watering and feeding routines tuned for one plant's species: a summer and a winter rhythm. */
export function careFor(plant: Pick<Plant, 'id'>, s: Species, names: { waterSummer: string; waterWinter: string; feed: string }, order: number, newId: () => string): TaskDraft[] {
  const base = (id: string, name: string, emoji: string, color: string, every: number, months: number[], preset: string, i: number): TaskDraft => ({
    id, name, emoji, color, group: 'care', every, unit: 'day', lead: 0, plantIds: [plant.id], months, preset, order: order + i,
  });
  const out = [
    base(newId(), names.waterSummer, '💧', '#4a90d9', s.waterSummer, GROWING, 'water-summer', 0),
    base(newId(), names.waterWinter, '💧', '#2bb3a0', s.waterWinter, DORMANT, 'water-winter', 1),
  ];
  if (s.feed) out.push({ ...base(newId(), names.feed, '🧪', '#7bc043', s.feed, GROWING, 'feed', 2), unit: 'day', lead: 1 });
  return out;
}
