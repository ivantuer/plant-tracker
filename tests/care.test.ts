import { describe, expect, it } from 'vitest';
import { allItems, itemFor, upcomingDays } from '../src/care';
import { addInterval, nextActiveDay } from '../src/dates';
import { data, log, plant, task } from './helpers';

const noon = (day: string) => `${day}T12:00:00.000Z`;

describe('scheduling', () => {
  it('a never-done routine is due on its start date or today', () => {
    expect(itemFor(task('w'), plant('a'), [], '2026-10-25').due).toBe('2026-10-25');
    expect(itemFor(task('w', { startDate: '2026-11-02' }), plant('a'), [], '2026-10-25').due).toBe('2026-11-02');
  });

  it('counts the interval from the last log', () => {
    const i = itemFor(task('w', { every: 7, unit: 'day' }), plant('a'), [log('1', 'w', 'a', noon('2026-10-20'))], '2026-10-25');
    expect(i.due).toBe('2026-10-27');
    expect(i.status).toBe('ok');
    expect(i.days).toBe(2);
  });

  it('flags overdue, today and soon', () => {
    const t = task('w', { every: 7, unit: 'day', lead: 2 });
    const at = (last: string) => itemFor(t, plant('a'), [log('1', 'w', 'a', noon(last))], '2026-10-25').status;
    expect(at('2026-10-10')).toBe('overdue');
    expect(at('2026-10-18')).toBe('today');
    expect(at('2026-10-20')).toBe('soon');
    expect(at('2026-10-24')).toBe('ok');
  });

  it('waits for the active season', () => {
    const heating = task('mite', { every: 2, unit: 'week', months: [10, 11, 12, 1, 2, 3, 4] });
    expect(itemFor(heating, plant('a'), [log('1', 'mite', 'a', noon('2026-04-20'))], '2026-05-01').due).toBe('2026-10-01');
    expect(nextActiveDay('2026-06-15', [10, 11])).toBe('2026-10-01');
  });

  it('a hand-set next date beats the season', () => {
    const t = task('w', { months: [4] });
    expect(itemFor(t, plant('a'), [log('1', 'w', 'a', noon('2026-04-01'), { nextDue: '2026-07-07' })], '2026-05-01').due).toBe('2026-07-07');
  });

  it('applies only to chosen plants and ends a finished course', () => {
    const d = data({
      plants: [plant('a'), plant('b')],
      tasks: [task('mist', { plantIds: ['a'] }), task('course', { every: 7, unit: 'day', limit: 2 })],
      logs: [log('1', 'course', 'a', noon('2026-10-01')), log('2', 'course', 'a', noon('2026-10-08')), log('3', 'course', 'b', noon('2026-10-01'), { skipped: true })],
    });
    const keys = allItems(d, '2026-10-25').map((i) => `${i.task.id}:${i.plant.id}`).sort();
    expect(keys).toEqual(['course:b', 'mist:a']);
  });

  it('projects the remaining doses of a course', () => {
    const d = data({ plants: [plant('a')], tasks: [task('c', { every: 5, unit: 'day', limit: 3 })], logs: [log('1', 'c', 'a', noon('2026-10-20'))] });
    const [item] = allItems(d, '2026-10-25');
    expect(item.left).toBe(2);
    expect(upcomingDays(item, '2026-10-25', '2026-12-31')).toEqual(['2026-10-25', '2026-10-30']);
  });
});

describe('dates', () => {
  it('clamps month steps to the end of a shorter month', () => {
    expect(addInterval('2026-01-31', 1, 'month')).toBe('2026-02-28');
    expect(addInterval('2026-10-25', 1, 'year')).toBe('2027-10-25');
  });
});

describe('reminders', () => {
  it('wakes the phone when an item enters its lead window, then nags a few days while overdue', async () => {
    const { reminderTimes } = await import('../src/care');
    const { atHour } = await import('../src/dates');
    const d = data({ plants: [plant('a')], tasks: [task('w', { every: 7, unit: 'day', lead: 2 })], logs: [log('1', 'w', 'a', noon('2026-10-20'))] });
    const items = allItems(d, '2026-10-25');
    const now = atHour('2026-10-25', 12);
    const times = reminderTimes(items, 9, now);
    expect(times[0]).toBe(atHour('2026-10-27', 9)); // the lead-window start (25th, 9:00) has already passed
    expect(times).toHaveLength(4);
    expect(times.every((t) => t > now)).toBe(true);
  });

  it('writes a digest in the right language', async () => {
    const { digest } = await import('../src/digest');
    const d = data({ plants: [plant('a', { name: 'Monty' }), plant('b')], tasks: [task('w', { name: 'Полив' })] });
    const uk = digest(d, 'uk', '2026-10-25')!;
    expect(uk.title).toContain('2');
    expect(uk.body).toContain('Monty: Полив');
    expect(digest(data(), 'en')).toBeNull();
  });
});
