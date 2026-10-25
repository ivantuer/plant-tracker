// Pure scheduling logic: what is due, for which plant. No DOM, so it is easy to test.
import type { Log, Plant, SyncData, Task } from './types';
import { addInterval, atHour, daysBetween, localDate, nextActiveDay } from './dates';

export type Status = 'overdue' | 'today' | 'soon' | 'ok';

export interface Item {
  task: Task;
  plant: Plant;
  last?: Log;
  /** YYYY-MM-DD */
  due: string;
  /** Days from today to the due date; negative when overdue. */
  days: number;
  status: Status;
  /** Doses left in a treatment course; undefined when the routine has no limit. */
  left?: number;
}

export const lastLog = (logs: Log[], taskId: string, plantId: string): Log | undefined => {
  let best: Log | undefined;
  for (const l of logs) if (l.taskId === taskId && l.plantId === plantId && (!best || l.at > best.at)) best = l;
  return best;
};

const timesDone = (logs: Log[], taskId: string, plantId: string) => logs.filter((l) => l.taskId === taskId && l.plantId === plantId && !l.skipped).length;

/** A course (limit) that is finished no longer applies to that plant. */
export const appliesTo = (t: Task, plantId: string, logs: Log[] = []) =>
  !t.archived && (t.plantIds.length === 0 || t.plantIds.includes(plantId)) && !(t.limit && timesDone(logs, t.id, plantId) >= t.limit);

export function itemFor(task: Task, plant: Plant, logs: Log[], today: string): Item {
  const last = lastLog(logs, task.id, plant.id);
  const raw = last ? last.nextDue ?? addInterval(localDate(new Date(last.at)), task.every, task.unit) : task.startDate ?? today;
  // A date set by hand is respected; a computed one waits for the active season.
  const due = last?.nextDue ? raw : nextActiveDay(raw, task.months);
  const days = daysBetween(today, due);
  const status: Status = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= task.lead ? 'soon' : 'ok';
  const left = task.limit ? Math.max(0, task.limit - timesDone(logs, task.id, plant.id)) : undefined;
  return { task, plant, last, due, days, status, left };
}

/** Every task/plant pair that applies, soonest first. */
export function allItems(d: Pick<SyncData, 'plants' | 'tasks' | 'logs'>, today = localDate()): Item[] {
  const out: Item[] = [];
  for (const task of d.tasks) for (const plant of d.plants) if (appliesTo(task, plant.id, d.logs)) out.push(itemFor(task, plant, d.logs, today));
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.task.order - b.task.order || a.plant.name.localeCompare(b.plant.name));
}

/** The next time each task is due after `from`, repeated until `to` (for the calendar). Overdue ones show on `from`. */
export function upcomingDays(item: Item, from: string, to: string): string[] {
  const out: string[] = [];
  let day = item.due < from ? from : item.due;
  for (let n = 0; n < 60 && day <= to; n++) {
    out.push(day);
    day = nextActiveDay(addInterval(day, item.task.every, item.task.unit), item.task.months);
    if (item.left !== undefined && n + 1 >= item.left) break;
  }
  return out;
}

export const age = (plantedOn: string, today = localDate()) => {
  const days = daysBetween(plantedOn, today);
  return days < 0 ? null : days;
};

export const needsAttention = (i: Item) => i.status !== 'ok';

/**
 * When to wake the phone: the reminder hour on the day each item enters its lead window, then on each following day
 * while it is overdue (a few nudges, not forever). Timestamps in ms, future only, soonest first, capped.
 */
export function reminderTimes(items: Item[], hour: number, now = Date.now(), horizonDays = 60, cap = 64): number[] {
  const set = new Set<number>();
  const add = (day: string) => {
    const t = atHour(day, hour);
    if (t > now && t < now + horizonDays * 86_400_000) set.add(t);
  };
  for (const i of items) {
    add(addInterval(i.due, -i.task.lead, 'day'));
    for (let n = 0; n <= 3; n++) add(addInterval(i.due, n, 'day'));
  }
  return [...set].sort((a, b) => a - b).slice(0, cap);
}
