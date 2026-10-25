import { useState } from 'preact/hooks';
import { allItems, type Item, type Status } from './care';
import { localDate } from './dates';
import { agoText, dueText, fmtDay, fmtLongDay, nameOf } from './format';
import { t } from './i18n';
import { LogSheet } from './sheets';
import { logCare, patchSettings, removeLog, state } from './store';
import { sync, vault } from './sync';
import { Badge, Chip, Empty, Topbar, showToast } from './ui';

export function SyncDot() {
  const s = sync.value;
  if (!vault.value) return null;
  const mode = s.error === 'auth' ? 'bad' : s.error ? 'off' : s.live ? 'live' : 'idle';
  return <span class={`dot ${mode}`} title={t(`sync.${mode}`)}><i />{t(`sync.${mode}`)}</span>;
}

export function PlantFilter() {
  const { plants, settings } = state.value;
  if (plants.length < 2) return null;
  return (
    <div class="chips scroll-x">
      <Chip on={settings.plantFilter === 'all'} onClick={() => patchSettings({ plantFilter: 'all' })}>{t('all')}</Chip>
      {plants.map((p) => <Chip key={p.id} on={settings.plantFilter === p.id} onClick={() => patchSettings({ plantFilter: p.id })}>{p.emoji} {p.name}</Chip>)}
    </div>
  );
}

function done(i: Item) {
  const id = logCare({ taskId: i.task.id, plantId: i.plant.id });
  showToast(`${i.task.emoji} ${nameOf(i.task)} · ${i.plant.name}`, () => removeLog(id));
}

function Card({ i, showPlant, onOpen }: { i: Item; showPlant: boolean; onOpen: () => void }) {
  const sub = i.last ? t(i.last.skipped ? 'lastSkipped' : 'last', { when: agoText(i.last.at) }) : t('never');
  return (
    <div class={`item ${i.status}`}>
      <button class="item-main" onClick={onOpen}>
        <Badge emoji={i.task.emoji} color={i.task.color} />
        <span class="item-text">
          <b>{nameOf(i.task)}</b>
          <span class="small due">{showPlant && <>{i.plant.emoji} {i.plant.name} · </>}{dueText(i.days)}{i.status === 'ok' && <> · {fmtDay(i.due)}</>}</span>
          <span class="small muted">{sub}</span>
        </span>
      </button>
      <button class="done" aria-label={t('done')} onClick={() => done(i)}>✓</button>
    </div>
  );
}

const SECTIONS: { status: Status; key: string }[] = [
  { status: 'overdue', key: 'sec.overdue' },
  { status: 'today', key: 'sec.today' },
  { status: 'soon', key: 'sec.soon' },
  { status: 'ok', key: 'sec.later' },
];

/** The "Later" list shows only the next month; the rest lives in the calendar and on the plant. */
const LATER_DAYS = 30;

export function Today({ goPlants }: { goPlants: () => void }) {
  const [open, setOpen] = useState<{ taskId: string; plantId: string } | null>(null);
  const s = state.value;
  const filter = s.settings.plantFilter;
  const all = allItems(s).filter((i) => filter === 'all' || i.plant.id === filter);
  const showPlant = s.plants.length > 1 && filter === 'all';
  const attention = all.filter((i) => i.status !== 'ok').length;
  const current = open ? all.find((i) => i.task.id === open.taskId && i.plant.id === open.plantId) : undefined;

  return (
    <>
      <Topbar title={fmtLongDay(localDate())} sub={all.length ? (attention ? t('attention', { n: String(attention) }) : t('allGood')) : undefined}><SyncDot /></Topbar>
      <PlantFilter />
      {s.plants.length === 0 && <Empty emoji="🪴" title={t('noPlants')} text={t('noPlantsText')}><button class="btn primary" onClick={goPlants}>{t('addPlant')}</button></Empty>}
      {s.plants.length > 0 && s.tasks.length === 0 && <Empty emoji="📋" title={t('noTasks')} text={t('noTasksText')}><button class="btn primary" onClick={goPlants}>{t('openRoutines')}</button></Empty>}
      {SECTIONS.map(({ status, key }) => {
        const rows = all.filter((i) => i.status === status && (status !== 'ok' || i.days <= LATER_DAYS));
        if (!rows.length) return null;
        return (
          <section key={status}>
            <div class={`sec ${status}`}>{t(key)} <span class="count">{rows.length}</span></div>
            {rows.map((i) => <Card key={i.task.id + i.plant.id} i={i} showPlant={showPlant} onOpen={() => setOpen({ taskId: i.task.id, plantId: i.plant.id })} />)}
          </section>
        );
      })}
      {current && <LogSheet item={current} onClose={() => setOpen(null)} />}
    </>
  );
}
