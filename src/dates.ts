import type { Unit } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const localDate = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Noon of that local day, so DST shifts never move it to another date. */
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Adds an interval to a date. Month steps clamp to the end of a shorter month (31 Jan + 1 month = 28 Feb). */
export function addInterval(day: string, n: number, unit: Unit): string {
  const [y, m, d] = day.split('-').map(Number);
  if (unit === 'day') return localDate(new Date(y, m - 1, d + n, 12));
  if (unit === 'week') return localDate(new Date(y, m - 1, d + 7 * n, 12));
  const months = unit === 'year' ? 12 * n : n;
  const last = new Date(y, m - 1 + months + 1, 0).getDate();
  return localDate(new Date(y, m - 1 + months, Math.min(d, last), 12));
}

export const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);

/** Moves a date forward to the first day of the next active month if its own month is not active. */
export function nextActiveDay(day: string, months: number[]): string {
  if (!months.length) return day;
  const [y, m] = day.split('-').map(Number);
  if (months.includes(m)) return day;
  for (let i = 1; i <= 12; i++) {
    const t = new Date(y, m - 1 + i, 1, 12);
    if (months.includes(t.getMonth() + 1)) return localDate(t);
  }
  return day;
}

/** The moment `hour`:00 local time on a given day. */
export const atHour = (day: string, hour: number) => {
  const d = parseDay(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

/** A timestamp for a chosen day: the current time when it is today, otherwise midday. */
export function stampFor(day: string, now = new Date()): string {
  if (day === localDate(now)) return now.toISOString();
  return parseDay(day).toISOString();
}
