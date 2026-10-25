import { effect, signal } from '@preact/signals';
import { get, set } from 'idb-keyval';
import type { AppState, Lang, Log, Milestone, MilestoneKind, Plant, SyncData, Task } from './types';
import { draftFromPreset, careFor, presetByKey, PEST_PLAN, type TaskDraft } from './presets';
import { mergeData, prune } from './merge';
import { addInterval, localDate, stampFor } from './dates';
import { translate } from './i18n';
import { speciesByKey } from './species';

export const STATE_KEY = 'plant-care-state';

const guessLang = (): Lang => (typeof navigator !== 'undefined' && /^uk|^ru/i.test(navigator.language) ? 'uk' : 'en');

export const defaults = (): AppState => ({
  version: 1,
  plants: [],
  milestones: [],
  tasks: [],
  logs: [],
  tombstones: {},
  settings: { me: '', lang: guessLang(), theme: 'auto', accent: '#3fae6a', hour: 9, plantFilter: 'all', server: '', push: false, notify: false },
});

export const state = signal<AppState>(defaults());
export const ready = signal(false);

export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** Called after every change to shared data; the sync engine plugs in here. */
export const hooks = { dataChanged: () => {}, resumed: () => {} };

export async function init() {
  const saved = await get<AppState>(STATE_KEY);
  if (saved) state.value = { ...defaults(), ...saved, settings: { ...defaults().settings, ...saved.settings } };
  ready.value = true;
  effect(() => {
    if (ready.value) void set(STATE_KEY, JSON.parse(JSON.stringify(state.value)));
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && hooks.resumed());
}

export const sharedData = (): SyncData => {
  const { plants, milestones, tasks, logs, tombstones } = state.value;
  return { plants, milestones, tasks, logs, tombstones };
};

/** Writes shared data and tells the sync engine; the single place where records change. */
function commit(fn: (d: SyncData) => SyncData) {
  state.value = { ...state.value, ...prune(fn(sharedData())) };
  hooks.dataChanged();
}

/** Applies data that arrived from the other phone; does not trigger another upload by itself. */
export function applySynced(d: SyncData) {
  state.value = { ...state.value, ...d };
}

export function patchSettings(p: Partial<AppState['settings']>) {
  state.value = { ...state.value, settings: { ...state.value.settings, ...p } };
}

const lng = () => state.value.settings.lang;

// ---- plants ----------------------------------------------------------------------------------------------

export function savePlant(p: Omit<Plant, 'updatedAt'>) {
  commit((s) => ({ ...s, plants: [...s.plants.filter((x) => x.id !== p.id), { ...p, updatedAt: now() }] }));
}

export function removePlant(id: string) {
  commit((s) => ({ ...s, plants: s.plants.filter((x) => x.id !== id), tombstones: { ...s.tombstones, [id]: now() } }));
  if (state.value.settings.plantFilter === id) patchSettings({ plantFilter: 'all' });
}

// ---- tasks -----------------------------------------------------------------------------------------------

export function saveTask(t: Omit<Task, 'updatedAt'>) {
  commit((s) => ({ ...s, tasks: [...s.tasks.filter((x) => x.id !== t.id), { ...t, updatedAt: now() }] }));
}

export function removeTask(id: string) {
  commit((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== id), tombstones: { ...s.tombstones, [id]: now() } }));
}

export const nextOrder = () => Math.max(-1, ...state.value.tasks.map((t) => t.order)) + 1;

function addTasks(drafts: TaskDraft[]) {
  const stamp = now();
  commit((s) => ({ ...s, tasks: [...s.tasks, ...drafts.map((d) => ({ ...d, updatedAt: stamp }))] }));
}

/** Adds one stock routine (optionally only for some plants). */
export function addPreset(key: string, plantIds: string[] = [], startDate?: string) {
  const p = presetByKey(key);
  if (p) addTasks([{ ...draftFromPreset(p, translate(lng(), `preset.${key}`), nextOrder(), uid(), plantIds), ...(startDate ? { startDate } : {}) }]);
}

/** Watering for the season and feeding, tuned to the species of a plant. */
export function addSpeciesCare(plant: Pick<Plant, 'id' | 'species'>) {
  const sp = speciesByKey(plant.species);
  if (!sp) return;
  const l = lng();
  addTasks(careFor(plant, sp, { waterSummer: translate(l, 'preset.water-summer'), waterWinter: translate(l, 'preset.water-winter'), feed: translate(l, 'preset.feed') }, nextOrder(), uid));
}

export const hasSpeciesCare = (plantId: string) => state.value.tasks.some((t) => !t.archived && t.preset === 'water-summer' && t.plantIds.includes(plantId));

/** The prevention plan for every plant; routines already present are left alone. */
export function addPestPlan() {
  const have = new Set(state.value.tasks.filter((t) => t.group === 'pest').map((t) => t.preset));
  // Staggered, so the first day is not a wall of ten chores.
  const offset: Record<string, number> = { check: 0, shower: 3, mite: 1, bio: 7, traps: 10 };
  for (const key of PEST_PLAN) if (!have.has(key)) addPreset(key, [], addInterval(localDate(), offset[key] ?? 0, 'day'));
}

/** A treatment course for a found pest: N doses a few days apart, for the chosen plants, starting on a chosen day. */
export function addTreatment(o: { name: string; plantIds: string[]; startDate: string; every: number; times: number; notes: string }) {
  addTasks([{ id: uid(), name: o.name, emoji: '🐛', color: '#e0605c', group: 'pest', every: o.every, unit: 'day', lead: 1, plantIds: o.plantIds, months: [], startDate: o.startDate, limit: o.times, notes: o.notes, order: nextOrder() }]);
}

// ---- logs ------------------------------------------------------------------------------------------------

export interface LogInput { taskId: string; plantId: string; day?: string; note?: string; nextDue?: string; skipped?: boolean }

/** Records a procedure as done (or skipped) and returns its id, so it can be undone. */
export function logCare(i: LogInput): string {
  const id = uid();
  const log: Log = {
    id, taskId: i.taskId, plantId: i.plantId, at: stampFor(i.day ?? localDate()), by: state.value.settings.me || undefined,
    ...(i.note ? { note: i.note } : {}), ...(i.nextDue ? { nextDue: i.nextDue } : {}), ...(i.skipped ? { skipped: true } : {}),
    updatedAt: now(),
  };
  commit((s) => ({ ...s, logs: [...s.logs, log] }));
  return id;
}

export function saveLog(l: Omit<Log, 'updatedAt'>) {
  commit((s) => ({ ...s, logs: [...s.logs.filter((x) => x.id !== l.id), { ...l, updatedAt: now() }] }));
}

export function removeLog(id: string) {
  commit((s) => ({ ...s, logs: s.logs.filter((x) => x.id !== id), tombstones: { ...s.tombstones, [id]: now() } }));
}

// ---- milestones ------------------------------------------------------------------------------------------

export function saveMilestone(m: Omit<Milestone, 'updatedAt'>) {
  commit((s) => ({ ...s, milestones: [...s.milestones.filter((x) => x.id !== m.id), { ...m, updatedAt: now() }] }));
}

export function removeMilestone(id: string) {
  commit((s) => ({ ...s, milestones: s.milestones.filter((x) => x.id !== id), tombstones: { ...s.tombstones, [id]: now() } }));
}

export const addMilestone = (plantId: string, kind: MilestoneKind, day: string, note?: string) => saveMilestone({ id: uid(), plantId, kind, day, ...(note ? { note } : {}) });

// ---- backup ----------------------------------------------------------------------------------------------

export const exportJson = () => JSON.stringify({ app: 'plant-care-tracker', ...sharedData() }, null, 2);

/** Merges a backup into the current data (nothing is deleted). */
export function importJson(text: string) {
  const j = JSON.parse(text) as Partial<SyncData> & { app?: string };
  if (j.app !== 'plant-care-tracker') throw new Error('not a backup');
  const incoming: SyncData = { plants: j.plants ?? [], milestones: j.milestones ?? [], tasks: j.tasks ?? [], logs: j.logs ?? [], tombstones: j.tombstones ?? {} };
  commit((s) => mergeData(s, incoming));
}
