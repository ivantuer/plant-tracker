import { useState } from 'preact/hooks';
import { addInterval, localDate } from './dates';
import { DatePicker } from './datepicker';
import { monthLong, seasonLabel } from './format';
import { lang, t } from './i18n';
import { pendingPlant } from './meta';
import { MONTH_PLAN, PESTS, type Pest } from './pests';
import { PEST_PLAN } from './presets';
import { CareInfo } from './plants';
import { SPECIES, type Species } from './species';
import { addPestPlan, addTreatment, state } from './store';
import type { Plant } from './types';
import { Chip, Empty, Field, Seg, Sheet, Topbar, showToast } from './ui';
import { PlantSearch } from './search';
import { blankPlant } from './sheets';
import { fromHit, presetFromSpecies } from './pick';

type View = 'plants' | 'pests' | 'season';

export function Guide({ goPlants }: { goPlants: () => void }) {
  const [view, setView] = useState<View>('pests');
  return (
    <>
      <Topbar title={t('tab.guide')} sub={t('guide.sub')} />
      <Seg<View> value={view} options={[['pests', t('guide.pests')], ['season', t('guide.season')], ['plants', t('guide.plants')]]} onChange={setView} />
      <div style={{ height: '14px' }} />
      {view === 'plants' && <SpeciesList goPlants={goPlants} />}
      {view === 'pests' && <Pests />}
      {view === 'season' && <Season />}
    </>
  );
}

// ---- species ---------------------------------------------------------------------------------------------

function SpeciesList({ goPlants }: { goPlants: () => void }) {
  const [open, setOpen] = useState<Species | null>(null);
  const add = (p: Partial<Plant>) => { pendingPlant.value = p; setOpen(null); goPlants(); };
  return (
    <>
      <PlantSearch placeholder={t('searchAnyPlant')} onPick={(h) => (h.kind === 'guide' ? setOpen(h.species) : add(fromHit(blankPlant(0), h)))} />
      <p class="hint" style={{ margin: '6px 2px 12px' }}>{t('searchAnyHint')}</p>
      <div class="sec">{t('guideTitle')}</div>
      {SPECIES.map((s) => (
        <button key={s.key} class="species-row" onClick={() => setOpen(s)}>
          <span class="badge" style={{ width: '40px', height: '40px', fontSize: '22px', background: 'var(--field)' }}>{s.emoji}</span>
          <span class="item-text"><b>{s.name[lang.value]}</b><span class="small muted">{t(`light.${s.light}`)} · {t('info.waterVal', { s: String(s.waterSummer), w: String(s.waterWinter) })}</span></span><span class="chev">›</span>
        </button>
      ))}
      {open && (
        <Sheet title={`${open.emoji} ${open.name[lang.value]}`} onClose={() => setOpen(null)}>
          <CareInfo s={open} />
          <button class="btn primary block" onClick={() => add(presetFromSpecies(open.key))}>{t('addThisPlant')}</button>
        </Sheet>
      )}
    </>
  );
}

// ---- pests -----------------------------------------------------------------------------------------------

function Pests() {
  const [open, setOpen] = useState<Pest | null>(null);
  const s = state.value;
  const month = new Date().getMonth() + 1;
  const have = new Set(s.tasks.filter((x) => x.group === 'pest' && !x.archived).map((x) => x.preset));
  const missing = PEST_PLAN.filter((k) => !have.has(k));
  const now = PESTS.filter((p) => p.season.includes(month));
  return (
    <>
      <div class="card">
        <h2>🛡️ {t('pestPlan')}</h2>
        <p class="muted small">{t('pestPlanText')}</p>
        <ul class="plain small">{PEST_PLAN.map((k) => <li key={k}>{have.has(k) ? '✓' : '○'} {t(`preset.${k}`)} <span class="muted">— {t(`presetHint.${k}`)}</span></li>)}</ul>
        {missing.length > 0 && <button class="btn primary block" disabled={!s.plants.length} onClick={() => { addPestPlan(); showToast(t('planAdded')); }}>{t('addPestPlan')}</button>}
        {!s.plants.length && <p class="hint">{t('addPlantFirst')}</p>}
      </div>

      {now.length > 0 && <div class="card"><h2>📅 {t('nowInSeason', { m: monthLong(month) })}</h2><div class="chips">{now.map((p) => <Chip key={p.key} on={false} onClick={() => setOpen(p)}>{p.emoji} {p.name[lang.value]}</Chip>)}</div></div>}

      <div class="sec">{t('commonPests')}</div>
      {PESTS.map((p) => (
        <button key={p.key} class="species-row" onClick={() => setOpen(p)}>
          <span class="badge" style={{ width: '40px', height: '40px', fontSize: '22px', background: 'var(--field)' }}>{p.emoji}</span>
          <span class="item-text"><b>{p.name[lang.value]}</b><span class="small muted">{t('mostCommon')}: {seasonLabel(p.season)}</span></span><span class="chev">›</span>
        </button>
      ))}
      <p class="hint">{t('pestDisclaimer')}</p>
      {open && <PestSheet p={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PestSheet({ p, onClose }: { p: Pest; onClose: () => void }) {
  const plants = state.value.plants;
  const [pick, setPick] = useState<string[]>([]);
  const [start, setStart] = useState(localDate());
  const [planning, setPlanning] = useState(false);
  const plan = () => {
    addTreatment({ name: `${t('treatment')}: ${p.name[lang.value]}`, plantIds: pick, startDate: start, every: p.gap, times: p.times, notes: p.product[lang.value] });
    showToast(t('treatmentAdded'));
    onClose();
  };
  return (
    <Sheet title={`${p.emoji} ${p.name[lang.value]}`} onClose={onClose}>
      <div class="card">
        <h2>{t('pest.signs')}</h2><p>{p.signs[lang.value]}</p>
        <h2>{t('pest.what')}</h2><p class="steps">{p.steps[lang.value]}</p>
        <h2>{t('pest.product')}</h2><p>{p.product[lang.value]}</p>
        <p class="note">{t('pest.course', { n: String(p.times), d: String(p.gap) })}</p>
        <p class="hint">{t('pestDisclaimer')}</p>
      </div>
      {!planning ? (
        <button class="btn primary block" disabled={!plants.length} onClick={() => setPlanning(true)}>{t('scheduleTreatment')}</button>
      ) : (
        <>
          <Field label={t('whichPlants')}><div class="chips">{plants.map((x) => <Chip key={x.id} on={pick.includes(x.id)} onClick={() => setPick(pick.includes(x.id) ? pick.filter((i) => i !== x.id) : [...pick, x.id])}>{x.emoji} {x.name}</Chip>)}</div></Field>
          <Field label={t('firstTreatment')}><DatePicker value={start} onChange={setStart} min={addInterval(localDate(), -7, 'day')} /></Field>
          <button class="btn primary block" disabled={!pick.length} onClick={plan}>{t('createCourse', { n: String(p.times), d: String(p.gap) })}</button>
        </>
      )}
    </Sheet>
  );
}

// ---- season ----------------------------------------------------------------------------------------------

function Season() {
  const now = new Date().getMonth();
  return (
    <>
      <Empty emoji="🗓️" title={t('seasonTitle')} text={t('seasonText')} />
      {MONTH_PLAN.map((m, i) => (
        <div key={i} class={`month-card${i === now ? ' now' : ''}`}>
          <span class="small muted">{monthLong(i + 1)}{i === now ? ` · ${t('thisMonth')}` : ''}</span>
          <h3>{m.title[lang.value]}</h3>
          <p>{m.tips[lang.value]}</p>
          <div class="chips" style={{ margin: '4px 0 0' }}>{PESTS.filter((p) => p.season.includes(i + 1)).map((p) => <span key={p.key} class="tag">{p.emoji} {p.name[lang.value]}</span>)}</div>
        </div>
      ))}
    </>
  );
}
