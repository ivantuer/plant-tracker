import type { Item } from './care';
import { addInterval, localDate } from './dates';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const te = new TextEncoder();

/** RFC 5545 lines are limited to 75 octets; continuation lines start with a space. */
const fold = (line: string) => {
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (te.encode(cur + ch).length > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
};

const FREQ = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' } as const;
const compact = (day: string) => day.replace(/-/g, '');

/**
 * An all-day calendar event per plant and routine at its next due date, repeating at the routine's interval (and only in
 * its active months, and only as many times as a treatment course lasts), with an alert on the morning of the day.
 * Calendars repeat on a fixed schedule, so after a late completion export again.
 */
export function buildIcs(items: Item[], hour: number, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plant Care Tracker//EN', 'CALSCALE:GREGORIAN'];
  for (const i of items) {
    const start = i.due < localDate(now) ? localDate(now) : i.due;
    const title = `${i.task.emoji} ${i.task.name}: ${i.plant.name}`;
    const rule = [`FREQ=${FREQ[i.task.unit]}`, `INTERVAL=${Math.max(1, i.task.every)}`];
    if (i.left !== undefined) rule.push(`COUNT=${Math.max(1, i.left)}`);
    if (i.task.months.length && i.task.months.length < 12) rule.push(`BYMONTH=${i.task.months.join(',')}`);
    lines.push(
      'BEGIN:VEVENT', `UID:${i.task.id}.${i.plant.id}@plant-care-tracker`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(start)}`, `DTEND;VALUE=DATE:${compact(addInterval(start, 1, 'day'))}`,
      `RRULE:${rule.join(';')}`, `SUMMARY:${esc(title)}`,
    );
    if (i.task.notes) lines.push(`DESCRIPTION:${esc(i.task.notes)}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:PT${hour}H`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
