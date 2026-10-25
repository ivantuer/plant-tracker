import { useState } from 'preact/hooks';
import { allItems, upcomingDays, type Item } from './care';
import { addInterval, localDate, parseDay } from './dates';
import { fmtLongDay, nameOf, ageText } from './format';
import { lang, t } from './i18n';
import { KINDS, kindMeta } from './meta';
import { EventSheet, LogSheet } from './sheets';
import { state } from './store';
import type { Milestone } from './types';
import { Topbar } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

interface DayData {
  events: { id: string; kind: Parameters<typeof kindMeta>[0]; plantId: string; m?: Milestone }[];
  done: { logId: string; item: { name: string; emoji: string; plant: string } }[];
  due: Item[];
}

/** Everything that happens in a month: planting and milestones, care that was done, and care still to come. */
function monthData(y: number, m: number): Map<string, DayData> {
  const s = state.value;
  const out = new Map<string, DayData>();
  const at = (day: string) => { let d = out.get(day); if (!d) out.set(day, (d = { events: [], done: [], due: [] })); return d; };
  const first = key(y, m, 1);
  const last = key(y, m, new Date(y, m + 1, 0).getDate());
  const inMonth = (day: string) => day >= first && day <= last;

  for (const p of s.plants) if (p.plantedOn && inMonth(p.plantedOn)) at(p.plantedOn).events.push({ id: `plant-${p.id}`, kind: 'plant', plantId: p.id });
  for (const ms of s.milestones) if (inMonth(ms.day)) at(ms.day).events.push({ id: ms.id, kind: ms.kind, plantId: ms.plantId, m: ms });
  for (const l of s.logs) {
    const day = localDate(new Date(l.at));
    const task = s.tasks.find((x) => x.id === l.taskId);
    const plant = s.plants.find((x) => x.id === l.plantId);
    if (l.skipped || !task || !plant || !inMonth(day)) continue;
    at(day).done.push({ logId: l.id, item: { name: nameOf(task), emoji: task.emoji, plant: plant.name } });
  }
  const today = localDate();
  const from = first > today ? first : today;
  if (from <= last) for (const item of allItems(s)) for (const day of upcomingDays(item, from, last)) if (inMonth(day)) at(day).due.push(item);
  return out;
}

export function Calendar() {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [sel, setSel] = useState(localDate());
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<Milestone | null>(null);
  const [log, setLog] = useState<Item | null>(null);
  const s = state.value;
  const data = monthData(y, m);
  const today = localDate();
  const loc = lang.value === 'uk' ? 'uk-UA' : 'en-GB';
  const shift = (n: number) => { const d = new Date(y, m + n, 1); setY(d.getFullYear()); setM(d.getMonth()); };
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(0), ...Array.from({ length: count }, (_, i) => i + 1)];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: 'short' }));
  const day = data.get(sel);
  const plantOf = (id: string) => s.plants.find((p) => p.id === id);

  return (
    <>
      <Topbar title={t('tab.calendar')} sub={t('calendar.sub')}><button class="btn small-btn primary" disabled={!s.plants.length} onClick={() => setAdd(true)}>+ {t('addEvent')}</button></Topbar>
      <div class="month-nav">
        <button class="icon-btn" aria-label="‹" onClick={() => shift(-1)}>‹</button>
        <h2>{new Date(y, m, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</h2>
        <button class="icon-btn" aria-label="›" onClick={() => shift(1)}>›</button>
      </div>
      <div class="mgrid" role="grid">
        {weekdays.map((w, i) => <span key={i} class="wd" style={{ textAlign: 'center' }}>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = key(y, m, d);
          const x = data.get(k);
          const marks = x ? [...x.events.map((e) => <em key={e.id}>{kindMeta(e.kind).emoji}</em>), ...(x.done.length ? [<i key="d" style={{ background: 'var(--good)' }} />] : []), ...(x.due.length ? [<i key="u" class="due" />] : [])] : [];
          return (
            <button key={i} class={`mday${k === today ? ' today' : ''}${k === sel ? ' sel' : ''}`} onClick={() => setSel(k)} aria-label={k}>
              <span>{d}</span>
              <span class="dots">{marks.slice(0, 4)}</span>
            </button>
          );
        })}
      </div>
      <div class="legend">
        {KINDS.map((x) => <span key={x.kind}>{x.emoji} {t(`kind.${x.kind}`)}</span>)}
        <span><i class="lg done" /> {t('cal.done')}</span><span><i class="lg due" /> {t('cal.due')}</span>
      </div>

      <div class="sec">{fmtLongDay(sel)}</div>
      {!day && <p class="muted">{t('cal.empty')}</p>}
      {day?.events.map((e) => {
        const p = plantOf(e.plantId);
        return p && (
          <button key={e.id} class="item plain-card" onClick={() => (e.m ? setEdit(e.m) : setAdd(true))}>
            <span class="tl-dot" style={{ background: kindMeta(e.kind).color }}>{kindMeta(e.kind).emoji}</span>
            <span class="item-text"><b>{t(`kind.${e.kind}`)} · {p.name}</b><span class="small muted">{e.m?.note ?? (e.kind === 'plant' ? ageText(sel, today) : '')}</span></span>
          </button>
        );
      })}
      {day?.done.map((d) => <div key={d.logId} class="item plain-card"><span class="tl-dot" style={{ background: 'var(--good)', color: '#fff' }}>✓</span><span class="item-text"><b>{d.item.emoji} {d.item.name}</b><span class="small muted">{d.item.plant}</span></span></div>)}
      {day?.due.map((i) => (
        <button key={i.task.id + i.plant.id} class={`item plain-card ${sel <= today ? i.status : ''}`} onClick={() => setLog(i)}>
          <span class="tl-dot due-dot">{i.task.emoji}</span>
          <span class="item-text"><b>{nameOf(i.task)}</b><span class="small muted">{i.plant.emoji} {i.plant.name} · {t('cal.planned')}</span></span><span class="chev">›</span>
        </button>
      ))}

      {add && <EventSheet day={sel <= addInterval(today, 1, 'year') ? sel : today} onClose={() => setAdd(false)} />}
      {edit && <EventSheet existing={edit} onClose={() => setEdit(null)} />}
      {log && <LogSheet item={log} onClose={() => setLog(null)} />}
    </>
  );
}

