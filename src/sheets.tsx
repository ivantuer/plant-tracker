import { useState } from 'preact/hooks';
import { addInterval, localDate } from './dates';
import { DatePicker } from './datepicker';
import { fmtDay, everyLabel, nameOf, agoText, monthName } from './format';
import { t } from './i18n';
import type { Item } from './care';
import { KINDS, kindMeta, type EventKind } from './meta';
import { addMilestone, logCare, removeLog, removeMilestone, removePlant, removeTask, saveLog, saveMilestone, savePlant, saveTask, state, addSpeciesCare, uid, nextOrder } from './store';
import { SPECIES, speciesByKey, PLANT_COLORS } from './species';
import type { Milestone, Plant, Task, Unit } from './types';
import { Avatar, Chip, Field, Seg, Sheet, showToast } from './ui';
import { lang } from './i18n';

// ---- one-tap done, with details --------------------------------------------------------------------------

export function LogSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const today = localDate();
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const [edit, setEdit] = useState<Task | null>(null);
  const logs = state.value.logs.filter((l) => l.taskId === item.task.id && l.plantId === item.plant.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  const save = (skipped: boolean) => {
    const id = logCare({ taskId: item.task.id, plantId: item.plant.id, day, note: note.trim(), nextDue: next, skipped });
    showToast(`${item.task.emoji} ${nameOf(item.task)} · ${item.plant.name}`, () => removeLog(id));
    onClose();
  };
  if (edit) return <TaskSheet task={edit} onClose={() => setEdit(null)} />;
  return (
    <Sheet title={`${item.task.emoji} ${nameOf(item.task)} · ${item.plant.name}`} onClose={onClose}>
      <p class="muted small">{everyLabel(item.task.every, item.task.unit)}{item.task.notes ? ` · ${item.task.notes}` : ''}</p>
      <div class="grid2">
        <Field label={t('doneOn')}><DatePicker value={day} onChange={setDay} max={today} /></Field>
        <Field label={t('nextDue')} hint={t('nextDueHint')}><DatePicker value={next} onChange={setNext} min={addInterval(today, 1, 'day')} clearable placeholder={t('auto')} /></Field>
      </div>
      <Field label={t('note')}><input type="text" value={note} placeholder={t('notePlaceholder')} onInput={(e) => setNote((e.target as HTMLInputElement).value)} /></Field>
      <div class="row gap"><button class="btn primary grow" onClick={() => save(false)}>{t('markDone')}</button><button class="btn" onClick={() => save(true)}>{t('skip')}</button></div>
      {logs.length > 0 && (
        <div>
          <h2>{t('recent')}</h2>
          <ul class="plain">
            {logs.map((l) => (
              <li key={l.id} class="row between small">
                <span>{l.skipped ? '⏭ ' : '✓ '}{fmtDay(localDate(new Date(l.at)), true)} <span class="muted">({agoText(l.at)}){l.by ? ` · ${l.by}` : ''}{l.note ? ` · ${l.note}` : ''}</span></span>
                <button class="icon-btn" aria-label={t('delete')} onClick={() => removeLog(l.id)}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button class="btn block" onClick={() => setEdit(item.task)}>{t('editRoutine')}</button>
    </Sheet>
  );
}

// ---- a routine -------------------------------------------------------------------------------------------

export function TaskSheet({ task, onClose, isNew }: { task: Task; onClose: () => void; isNew?: boolean }) {
  const [x, setX] = useState<Task>(task);
  const plants = state.value.plants;
  const set = (p: Partial<Task>) => setX({ ...x, ...p });
  const toggle = <K extends 'plantIds' | 'months'>(k: K, v: K extends 'months' ? number : string) =>
    set({ [k]: (x[k] as (string | number)[]).includes(v) ? (x[k] as (string | number)[]).filter((a) => a !== v) : [...(x[k] as (string | number)[]), v] } as Partial<Task>);
  const num = (v: string, min: number) => Math.max(min, Math.floor(Number(v) || min));
  return (
    <Sheet title={isNew ? t('addRoutine') : t('editRoutine')} onClose={onClose}>
      <div class="grid2">
        <Field label={t('name')}><input type="text" value={nameOf(x)} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} /></Field>
        <Field label={t('emoji')}><input type="text" value={x.emoji} maxLength={4} onInput={(e) => set({ emoji: (e.target as HTMLInputElement).value })} /></Field>
      </div>
      <Field label={t('kind')}><Seg value={x.group} options={[['care', t('group.care')], ['pest', t('group.pest')]]} onChange={(group) => set({ group })} /></Field>
      <Field label={t('repeat')}>
        <div class="row gap">
          <input type="number" min={1} value={x.every} onInput={(e) => set({ every: num((e.target as HTMLInputElement).value, 1) })} />
          <select value={x.unit} onChange={(e) => set({ unit: (e.target as HTMLSelectElement).value as Unit })}>
            {(['day', 'week', 'month', 'year'] as Unit[]).map((u) => <option key={u} value={u}>{t(`units.${u}`)}</option>)}
          </select>
        </div>
      </Field>
      <div class="grid2">
        <Field label={t('remindBeforeLabel')}><input type="number" min={0} value={x.lead} onInput={(e) => set({ lead: num((e.target as HTMLInputElement).value, 0) })} /></Field>
        <Field label={t('limit')} hint={t('limitHint')}><input type="number" min={0} value={x.limit ?? 0} onInput={(e) => set({ limit: num((e.target as HTMLInputElement).value, 0) || undefined })} /></Field>
      </div>
      <Field label={t('forPlants')} hint={t('forPlantsHint')}>
        <div class="chips">{plants.map((p) => <Chip key={p.id} on={x.plantIds.includes(p.id)} onClick={() => toggle('plantIds', p.id)}>{p.emoji} {p.name}</Chip>)}</div>
      </Field>
      <Field label={t('months')} hint={t('monthsHint')}>
        <div class="chips">{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <Chip key={m} on={x.months.includes(m)} onClick={() => toggle('months', m)}>{monthName(m)}</Chip>)}</div>
      </Field>
      <Field label={t('startDate')} hint={t('startDateHint')}><DatePicker value={x.startDate ?? ''} onChange={(v) => set({ startDate: v || undefined })} clearable placeholder={t('today')} /></Field>
      <Field label={t('note')}><textarea rows={2} value={x.notes ?? ''} onInput={(e) => set({ notes: (e.target as HTMLTextAreaElement).value || undefined })} /></Field>
      <div class="row between"><span>{t('paused')}</span><label class="switch"><input type="checkbox" checked={!!x.archived} onChange={(e) => set({ archived: (e.target as HTMLInputElement).checked })} /><span /></label></div>
      <div class="row gap">
        <button class="btn primary grow" disabled={!x.name.trim()} onClick={() => { saveTask(x); onClose(); }}>{t('save')}</button>
        {!isNew && <button class="btn danger" onClick={() => { if (confirm(t('deleteRoutineConfirm'))) { removeTask(x.id); onClose(); } }}>{t('delete')}</button>}
      </div>
    </Sheet>
  );
}

export const blankTask = (): Task => ({ id: uid(), name: '', emoji: '🌿', color: '#3fae6a', group: 'care', every: 1, unit: 'week', lead: 0, plantIds: [], months: [], order: nextOrder(), updatedAt: '' });

// ---- a milestone (sprouted, bloomed, ...) and planting ---------------------------------------------------

export function EventSheet({ plantId, day, kind, existing, onClose }: { plantId?: string; day?: string; kind?: EventKind; existing?: Milestone; onClose: () => void }) {
  const { plants } = state.value;
  const [pid, setPid] = useState(existing?.plantId ?? plantId ?? plants[0]?.id ?? '');
  const [k, setK] = useState<EventKind>(existing?.kind ?? kind ?? 'sprout');
  const [d, setD] = useState(existing?.day ?? day ?? localDate());
  const [note, setNote] = useState(existing?.note ?? '');
  const plant = plants.find((p) => p.id === pid);
  const save = () => {
    if (!plant) return;
    if (k === 'plant') savePlant({ ...plant, plantedOn: d });
    else if (existing) saveMilestone({ ...existing, plantId: pid, kind: k, day: d, note: note.trim() || undefined });
    else addMilestone(pid, k, d, note.trim() || undefined);
    showToast(`${kindMeta(k).emoji} ${t(`kind.${k}`)} · ${plant.name}`);
    onClose();
  };
  return (
    <Sheet title={existing ? t('editEvent') : t('addEvent')} onClose={onClose}>
      {!plantId && !existing && <Field label={t('plant')}><div class="chips">{plants.map((p) => <Chip key={p.id} on={pid === p.id} onClick={() => setPid(p.id)}>{p.emoji} {p.name}</Chip>)}</div></Field>}
      <Field label={t('whatHappened')}>
        <div class="chips">{KINDS.filter((x) => !existing || x.kind !== 'plant').map((x) => <Chip key={x.kind} on={k === x.kind} color={x.color} onClick={() => setK(x.kind)}>{x.emoji} {t(`kind.${x.kind}`)}</Chip>)}</div>
      </Field>
      <Field label={t('date')}><DatePicker value={d} onChange={setD} max={addInterval(localDate(), 1, 'year')} /></Field>
      {k !== 'plant' && <Field label={t('note')}><input type="text" value={note} placeholder={t('eventNotePlaceholder')} onInput={(e) => setNote((e.target as HTMLInputElement).value)} /></Field>}
      <div class="row gap">
        <button class="btn primary grow" disabled={!plant} onClick={save}>{t('save')}</button>
        {existing && <button class="btn danger" onClick={() => { removeMilestone(existing.id); onClose(); }}>{t('delete')}</button>}
      </div>
    </Sheet>
  );
}

// ---- a plant ---------------------------------------------------------------------------------------------

export function PlantForm({ plant, isNew, species, onClose }: { plant: Plant; isNew?: boolean; species?: string; onClose: () => void }) {
  const [x, setX] = useState<Plant>(species ? { ...plant, species, ...fromSpecies(species) } : plant);
  const [care, setCare] = useState(!!isNew);
  const set = (p: Partial<Plant>) => setX({ ...x, ...p });
  const sp = speciesByKey(x.species);
  // Picking a species fills the emoji, and the name too unless the user already typed their own.
  const pick = (key: string) => {
    const next = speciesByKey(key);
    const own = x.name.trim() && x.name !== speciesByKey(x.species)?.name[lang.value];
    setX({ ...x, species: next?.key, ...(next ? { emoji: next.emoji, ...(own ? {} : { name: next.name[lang.value] }) } : {}) });
  };
  const save = () => {
    const { updatedAt: _stamp, ...rest } = x;
    const p = { ...rest, name: x.name.trim() };
    savePlant(p);
    if (isNew && care && sp) addSpeciesCare(p);
    onClose();
  };
  return (
    <Sheet title={isNew ? t('addPlant') : t('editPlant')} onClose={onClose}>
      <Field label={t('species')}>
        <select value={x.species ?? ''} onChange={(e) => pick((e.target as HTMLSelectElement).value)}>
          <option value="">{t('otherPlant')}</option>
          {SPECIES.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.name[lang.value]}</option>)}
        </select>
      </Field>
      <div class="grid2">
        <Field label={t('name')}><input type="text" value={x.name} placeholder={t('plantNamePlaceholder')} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} /></Field>
        <Field label={t('emoji')}><input type="text" value={x.emoji} maxLength={4} onInput={(e) => set({ emoji: (e.target as HTMLInputElement).value })} /></Field>
      </div>
      <Field label={t('place')}><input type="text" value={x.place ?? ''} placeholder={t('placePlaceholder')} onInput={(e) => set({ place: (e.target as HTMLInputElement).value || undefined })} /></Field>
      <div class="grid2">
        <Field label={t('plantedOn')}><DatePicker value={x.plantedOn ?? ''} onChange={(v) => set({ plantedOn: v || undefined })} max={localDate()} clearable /></Field>
        <Field label={t('origin')}><select value={x.origin ?? ''} onChange={(e) => set({ origin: ((e.target as HTMLSelectElement).value || undefined) as Plant['origin'] })}>
          <option value="">—</option>{(['seed', 'cutting', 'bought', 'gift'] as const).map((o) => <option key={o} value={o}>{t(`origin.${o}`)}</option>)}
        </select></Field>
      </div>
      <Field label={t('color')}><div class="swatches">{PLANT_COLORS.map((c) => <button type="button" key={c} class={`sw${x.color === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => set({ color: c })} />)}</div></Field>
      <Field label={t('note')}><textarea rows={2} value={x.notes ?? ''} onInput={(e) => set({ notes: (e.target as HTMLTextAreaElement).value || undefined })} /></Field>
      {isNew && sp && <div class="row between"><span>{t('addCareToo')}</span><label class="switch"><input type="checkbox" checked={care} onChange={(e) => setCare((e.target as HTMLInputElement).checked)} /><span /></label></div>}
      <div class="row gap">
        <button class="btn primary grow" disabled={!x.name.trim()} onClick={save}>{t('save')}</button>
        {!isNew && <button class="btn danger" onClick={() => { if (confirm(t('deletePlantConfirm', { name: x.name }))) { removePlant(x.id); onClose(); } }}>{t('delete')}</button>}
      </div>
    </Sheet>
  );
}

const fromSpecies = (key: string) => { const s = speciesByKey(key); return s ? { emoji: s.emoji, name: s.name[lang.value] } : {}; };

export const blankPlant = (n: number): Plant => ({ id: uid(), name: '', emoji: '🪴', color: PLANT_COLORS[n % PLANT_COLORS.length], updatedAt: '' });
