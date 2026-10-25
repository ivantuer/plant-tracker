import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, pluralize, taskName } from '../src/i18n';
import { buildIcs } from '../src/ics';
import { allItems } from '../src/care';
import { PEST_PLAN, PRESETS } from '../src/presets';
import { PESTS, MONTH_PLAN } from '../src/pests';
import { SPECIES } from '../src/species';
import { data, plant, task } from './helpers';

const { en, uk } = DICTIONARIES;

describe('translations', () => {
  it('both languages have the same keys, except plural forms', () => {
    const base = (d: Record<string, string>) => Object.keys(d).filter((k) => !/\.(one|few|many|other)$/.test(k)).sort();
    expect(base(uk)).toEqual(base(en));
  });

  it('every literal key used in the source exists', () => {
    const src = readdirSync('src').filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(`src/${f}`, 'utf8')).join('\n');
    const keys = new Set([...src.matchAll(/\bt\('([\w.-]+)'/g)].map((m) => m[1]));
    expect([...keys].filter((k) => !(k in en))).toEqual([]);
  });

  it('dynamic key families are complete', () => {
    const need = [
      ...['plant', 'sprout', 'bud', 'bloom', 'bloomEnd', 'harvest'].map((k) => `kind.${k}`),
      ...['shade', 'part', 'bright', 'sun'].map((k) => `light.${k}`),
      ...['low', 'medium', 'high'].map((k) => `humidity.${k}`),
      ...['seed', 'cutting', 'bought', 'gift'].map((k) => `origin.${k}`),
      ...PRESETS.map((p) => `preset.${p.key}`), ...PEST_PLAN.map((k) => `presetHint.${k}`), ...['live', 'idle', 'off', 'bad'].map((k) => `sync.${k}`), ...['auto', 'light', 'dark'].map((k) => `theme.${k}`), 'preset.water-summer', 'preset.water-winter',
    ];
    expect(need.filter((k) => !(k in en) || !(k in uk))).toEqual([]);
  });

  it('pluralises Ukrainian days', () => {
    expect([1, 2, 5, 21].map((n) => pluralize('uk', 'n.day', n))).toEqual(['1 день', '2 дні', '5 днів', '21 день']);
  });

  it('shows stock routine names in the current language', () => {
    expect(taskName('en', uk['preset.water'])).toBe('Watering');
    expect(taskName('uk', 'My own thing')).toBe('My own thing');
  });
});

describe('guide data', () => {
  it('is complete and consistent', () => {
    expect(new Set(SPECIES.map((s) => s.key)).size).toBe(SPECIES.length);
    for (const s of SPECIES) { expect(s.waterWinter).toBeGreaterThanOrEqual(s.waterSummer); expect(s.tempMax).toBeGreaterThan(s.tempMin); expect(s.tip.uk && s.tip.en).toBeTruthy(); }
    expect(MONTH_PLAN).toHaveLength(12);
    for (const p of PESTS) { expect(p.times).toBeGreaterThan(0); expect(p.season.every((m) => m >= 1 && m <= 12)).toBe(true); }
  });
});

describe('calendar export', () => {
  it('writes a repeating all-day event limited to season and course length', () => {
    const d = data({ plants: [plant('a', { name: 'Monty' })], tasks: [task('t', { name: 'Treatment', every: 7, unit: 'day', months: [3, 4], limit: 3, startDate: '2026-03-05' })] });
    const ics = buildIcs(allItems(d, '2026-03-01'), 9, new Date('2026-03-01T08:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20260305');
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=7;COUNT=3;BYMONTH=3,4');
    expect(ics).toContain('TRIGGER:PT9H');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
