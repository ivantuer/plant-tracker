import { useState } from 'preact/hooks';
import { allItems } from './care';
import { localDate } from './dates';
import { ageText, dueText, everyLabel, fmtDay, nameOf, seasonLabel } from './format';
import { lang, t } from './i18n';
import { kindMeta, pendingSpecies } from './meta';
import { PRESETS } from './presets';
import { blankPlant, blankTask, EventSheet, LogSheet, PlantForm, TaskSheet } from './sheets';
import { SPECIES, speciesByKey, type Species } from './species';
import { addPreset, addSpeciesCare, hasSpeciesCare, state } from './store';
import type { Milestone, Plant, Task } from './types';
import { Avatar, Badge, Empty, Field, Seg, Sheet, Topbar } from './ui';

type View = 'plants' | 'routines';

export function Plants() {
  const [view, setView] = useState<View>('plants');
  const [form, setForm] = useState(pendingSpecies.value !== undefined);
  const [open, setOpen] = useState<string | null>(null);
  const s = state.value;
  const adding = pendingSpecies.value || undefined;
  const close = () => { setForm(false); pendingSpecies.value = undefined; };
  return (
    <>
      <Topbar title={t('tab.plants')} sub={t(view === 'plants' ? 'plants.sub' : 'routines.sub')}>
        {view === 'plants' && <button class="btn small-btn primary" onClick={() => setForm(true)}>+ {t('add')}</button>}
      </Topbar>
      <Seg<View> value={view} options={[['plants', t('plants.seg')], ['routines', t('routines.seg')]]} onChange={setView} />
      <div style={{ height: '14px' }} />
      {view === 'plants' ? (
        s.plants.length ? <div class="plant-grid">{s.plants.map((p) => <PlantCard key={p.id} p={p} onOpen={() => setOpen(p.id)} />)}</div>
          : <Empty emoji="🪴" title={t('noPlants')} text={t('noPlantsText')}><button class="btn primary" onClick={() => setForm(true)}>{t('addPlant')}</button></Empty>
      ) : <Routines />}
      {form && <PlantForm isNew plant={blankPlant(s.plants.length)} species={adding} onClose={close} />}
      {open && s.plants.some((p) => p.id === open) && <PlantSheet id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PlantCard({ p, onOpen }: { p: Plant; onOpen: () => void }) {
  const s = state.value;
  const sp = speciesByKey(p.species);
  const next = allItems(s).find((i) => i.plant.id === p.id);
  const last = s.milestones.filter((m) => m.plantId === p.id).sort((a, b) => b.day.localeCompare(a.day))[0];
  return (
    <button class="plant-card" onClick={onOpen}>
      <Avatar plant={p} size={52} />
      <b>{p.name}</b>
      <span class="small muted">{[sp?.name[lang.value], p.place].filter(Boolean).join(' · ') || ' '}</span>
      {p.plantedOn && <span class="small">🪴 {ageText(p.plantedOn)}</span>}
      {last && <span class="small">{kindMeta(last.kind).emoji} {t(`kind.${last.kind}`)} · {fmtDay(last.day)}</span>}
      {next && <span class={`small due ${next.status}`}>{next.task.emoji} {dueText(next.days)}</span>}
    </button>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div class="kv"><span class="muted">{k}</span><span>{v}</span></div>;

export function CareInfo({ s }: { s: Species }) {
  return (
    <div class="card">
      <h2>{s.emoji} {t('careInfo')}</h2>
      <Row k={t('info.light')} v={t(`light.${s.light}`)} />
      <Row k={t('info.water')} v={t('info.waterVal', { s: String(s.waterSummer), w: String(s.waterWinter) })} />
      <Row k={t('info.feed')} v={s.feed ? t('info.feedVal', { d: String(s.feed) }) : t('info.noFeed')} />
      <Row k={t('info.humidity')} v={t(`humidity.${s.humidity}`)} />
      <Row k={t('info.temp')} v={`${s.tempMin}–${s.tempMax} °C`} />
      <Row k={t('info.repot')} v={t('info.repotVal', { n: String(s.repotYears) })} />
      {s.bloom && <Row k={t('info.bloom')} v={seasonLabel(s.bloom)} />}
      <Row k={t('info.pets')} v={s.toxic ? t('pets.toxic') : t('pets.safe')} />
      <p class="note">💡 {s.tip[lang.value]}</p>
      <p class="hint">{t('info.disclaimer')}</p>
    </div>
  );
}

function PlantSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = state.value;
  const p = s.plants.find((x) => x.id === id)!;
  const sp = speciesByKey(p.species);
  const [edit, setEdit] = useState(false);
  const [event, setEvent] = useState<{ m?: Milestone; kind?: 'plant' } | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const items = allItems(s).filter((i) => i.plant.id === id);
  const cur = items.find((i) => i.task.id === item);
  const events = s.milestones.filter((m) => m.plantId === id).sort((a, b) => a.day.localeCompare(b.day));
  const sprout = events.find((m) => m.kind === 'sprout');
  const firstDays = p.plantedOn && sprout ? Math.round((new Date(sprout.day).getTime() - new Date(p.plantedOn).getTime()) / 86_400_000) : null;

  if (edit) return <PlantForm plant={p} onClose={() => setEdit(false)} />;
  if (event) return <EventSheet plantId={id} existing={event.m} kind={event.kind} onClose={() => setEvent(null)} />;
  if (task) return <TaskSheet task={task} onClose={() => setTask(null)} />;
  if (cur) return <LogSheet item={cur} onClose={() => setItem(null)} />;
  return (
    <Sheet title={`${p.emoji} ${p.name}`} onClose={onClose}>
      <div class="row gap">
        <Avatar plant={p} size={52} />
        <div class="grow"><b>{sp?.name[lang.value] ?? t('otherPlant')}</b><div class="small muted">{[p.place, p.origin && t(`origin.${p.origin}`)].filter(Boolean).join(' · ')}</div></div>
        <button class="btn small-btn" onClick={() => setEdit(true)}>{t('edit')}</button>
      </div>

      <div class="card">
        <div class="row between"><h2>{t('timeline')}</h2><button class="btn small-btn" onClick={() => setEvent({})}>+ {t('add')}</button></div>
        <ul class="plain timeline">
          <li><span class="tl-dot" style={{ background: kindMeta('plant').color }}>{kindMeta('plant').emoji}</span><button class="tl-text" onClick={() => setEvent({ kind: 'plant' })}><b>{t('kind.plant')}</b><span class="small muted">{p.plantedOn ? `${fmtDay(p.plantedOn, true)} · ${ageText(p.plantedOn)}` : t('notSet')}</span></button></li>
          {events.map((m) => (
            <li key={m.id}><span class="tl-dot" style={{ background: kindMeta(m.kind).color }}>{kindMeta(m.kind).emoji}</span>
              <button class="tl-text" onClick={() => setEvent({ m })}><b>{t(`kind.${m.kind}`)}</b><span class="small muted">{fmtDay(m.day, true)}{m.note ? ` · ${m.note}` : ''}{m.kind === 'sprout' && firstDays !== null && firstDays >= 0 ? ` · ${t('afterPlanting', { d: String(firstDays) })}` : ''}</span></button></li>
          ))}
        </ul>
      </div>

      <div class="card">
        <div class="row between"><h2>{t('plantRoutines')}</h2><button class="btn small-btn" onClick={() => setTask({ ...blankTask(), plantIds: [id] })}>+ {t('add')}</button></div>
        {items.length ? items.map((i) => (
          <button key={i.task.id} class="item plain-card flat" onClick={() => setItem(i.task.id)}>
            <Badge emoji={i.task.emoji} color={i.task.color} size={36} />
            <span class="item-text"><b>{nameOf(i.task)}</b><span class={`small due ${i.status}`}>{dueText(i.days)} · {fmtDay(i.due)}</span></span><span class="chev">›</span>
          </button>
        )) : <p class="muted small">{t('noRoutinesForPlant')}</p>}
        {sp && !hasSpeciesCare(id) && <button class="btn block" onClick={() => addSpeciesCare(p)}>{t('addCare')}</button>}
      </div>

      {sp && <CareInfo s={sp} />}
      {p.notes && <p class="note">{p.notes}</p>}
    </Sheet>
  );
}

// ---- the list of all routines ----------------------------------------------------------------------------

function Routines() {
  const [task, setTask] = useState<{ t: Task; isNew?: boolean } | null>(null);
  const s = state.value;
  const names = (tk: Task) => (tk.plantIds.length ? tk.plantIds.map((id) => s.plants.find((p) => p.id === id)?.name).filter(Boolean).join(', ') : t('allPlants'));
  const have = new Set(s.tasks.map((x) => x.preset));
  const groups: ['care' | 'pest', string][] = [['care', t('group.care')], ['pest', t('group.pest')]];
  return (
    <>
      {groups.map(([g, label]) => {
        const rows = s.tasks.filter((x) => x.group === g).sort((a, b) => a.order - b.order);
        return (
          <section key={g}>
            <div class="sec">{label} <span class="count">{rows.length}</span></div>
            {rows.map((tk) => (
              <button key={tk.id} class={`item plain-card${tk.archived ? ' archived' : ''}`} onClick={() => setTask({ t: tk })}>
                <Badge emoji={tk.emoji} color={tk.color} />
                <span class="item-text"><b>{nameOf(tk)}</b>
                  <span class="small muted">{everyLabel(tk.every, tk.unit)}{tk.months.length ? ` · ${seasonLabel(tk.months)}` : ''}{tk.limit ? ` · ${t('times', { n: String(tk.limit) })}` : ''}</span>
                  <span class="small muted">{names(tk)}{tk.archived ? ` · ${t('paused')}` : ''}</span></span>
                <span class="chev">›</span>
              </button>
            ))}
            <div class="chips" style={{ marginTop: '8px' }}>
              {PRESETS.filter((p) => p.group === g && !have.has(p.key)).map((p) => <button key={p.key} class="chip" onClick={() => addPreset(p.key)}>{p.emoji} {t(`preset.${p.key}`)}</button>)}
            </div>
          </section>
        );
      })}
      <button class="btn block" onClick={() => setTask({ t: blankTask(), isNew: true })}>+ {t('addRoutine')}</button>
      {task && <TaskSheet task={task.t} isNew={task.isNew} onClose={() => setTask(null)} />}
    </>
  );
}

