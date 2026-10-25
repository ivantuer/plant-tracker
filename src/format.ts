import { daysBetween, localDate, parseDay } from './dates';
import { lang, pluralize, t, translate, taskName } from './i18n';
import type { Task, Unit } from './types';

const locale = () => (lang.value === 'uk' ? 'uk-UA' : 'en-GB');

export const fmtDay = (day: string, year = false) =>
  parseDay(day).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });

export const fmtLongDay = (day: string) => parseDay(day).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

export const monthName = (m: number) => new Date(2024, m - 1, 1).toLocaleDateString(locale(), { month: 'short' });
export const monthLong = (m: number) => new Date(2024, m - 1, 1).toLocaleDateString(locale(), { month: 'long' });

export const unitName = (u: Unit) => t(`u.${u}`);

export const everyLabel = (n: number, unit: Unit) => (n === 1 ? t('every1', { u: unitName(unit) }) : t('every', { x: pluralize(lang.value, `n.${unit}`, n) }));

export const dueText = (days: number) =>
  days < 0 ? t('due.overdue', { d: pluralize(lang.value, 'n.day', -days) })
  : days === 0 ? t('due.today')
  : days === 1 ? t('due.tomorrow')
  : t('due.in', { d: pluralize(lang.value, 'n.day', days) });

/** "today", "yesterday" or "3 days ago" for an ISO timestamp. */
export function agoText(iso: string, today = localDate()) {
  const d = daysBetween(localDate(new Date(iso)), today);
  return d <= 0 ? t('today') : d === 1 ? t('yesterday') : t('ago', { d: pluralize(lang.value, 'n.day', d) });
}

/** Age of a plant from its planting date: "5 days", "3 months", "1 year 2 months". */
export function ageText(plantedOn: string, today = localDate()) {
  const days = daysBetween(plantedOn, today);
  if (days < 0) return t('inFuture');
  if (days < 60) return pluralize(lang.value, 'n.day', days);
  const months = Math.floor(days / 30.44);
  if (months < 24) return pluralize(lang.value, 'n.month', months);
  return pluralize(lang.value, 'n.year', Math.floor(months / 12));
}

export const nameOf = (task: Pick<Task, 'name'>) => taskName(lang.value, task.name);
export const monthsLabel = (months: number[]) => (months.length ? months.map(monthName).join(', ') : t('allYear'));
export const seasonLabel = (months: number[]) => {
  if (!months.length) return t('allYear');
  const sorted = [...months].sort((a, b) => a - b);
  const contiguous = sorted.every((m, i) => i === 0 || m === sorted[i - 1] + 1);
  return contiguous && sorted.length > 2 ? `${monthName(sorted[0])} – ${monthName(sorted[sorted.length - 1])}` : monthsLabel(months);
};
export { translate };
