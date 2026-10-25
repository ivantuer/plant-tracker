import { useState } from 'preact/hooks';
import { addInterval, localDate, parseDay } from './dates';
import { fmtDay } from './format';
import { lang, t } from './i18n';

const loc = () => (lang.value === 'uk' ? 'uk-UA' : 'en-GB');
const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

interface Props {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  /** Shows a Clear button and allows an empty value. */
  clearable?: boolean;
  placeholder?: string;
}

// The calendar sits inside the form's <label>; a click there would otherwise be forwarded to the field and reopen it,
// so every click on the overlay cancels that default action.
/** A field that opens a month calendar with quick picks. Replaces the browser's plain date input. */
export function DatePicker(p: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" class={`datefield${p.value ? '' : ' empty'}`} onClick={() => setOpen(true)}>
        <span>{p.value ? fmtDay(p.value, true) : (p.placeholder ?? t('pickDate'))}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2zM5 9h14v11H5z" /></svg>
      </button>
      {open && <Calendar {...p} onClose={() => setOpen(false)} />}
    </>
  );
}

function Calendar({ value, onChange, min, max, clearable, onClose }: Props & { onClose: () => void }) {
  const today = localDate();
  const start = parseDay(value || (max && max < today ? max : min && min > today ? min : today));
  const [y, setY] = useState(start.getFullYear());
  const [m, setM] = useState(start.getMonth());
  const [months, setMonths] = useState(false);

  const ok = (d: string) => (!min || d >= min) && (!max || d <= max);
  const pick = (d: string) => { if (ok(d)) { onChange(d); onClose(); } };
  const shift = (n: number) => { const t = new Date(y, m + n, 1); setY(t.getFullYear()); setM(t.getMonth()); };

  const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(0), ...Array.from({ length: count }, (_, i) => i + 1)];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc(), { weekday: 'narrow' }));
  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(loc(), { month: 'short' }));

  const quick: [string, string][] = max && max <= today
    ? [[t('today'), today], [t('yesterday'), addInterval(today, -1, 'day')], [t('weekAgo'), addInterval(today, -1, 'week')]]
    : [[t('tomorrow'), addInterval(today, 1, 'day')], [t('inWeek'), addInterval(today, 1, 'week')], [t('inMonth'), addInterval(today, 1, 'month')], [t('in3Months'), addInterval(today, 3, 'month')]];

  return (
    <div class="cal-wrap" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}>
      <div class="cal" role="dialog" aria-modal="true" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div class="cal-head">
          <button class="icon-btn" aria-label="‹" onClick={() => (months ? setY(y - 1) : shift(-1))}>‹</button>
          <button class="cal-title" onClick={() => setMonths(!months)}>
            {months ? y : new Date(y, m, 1).toLocaleDateString(loc(), { month: 'long', year: 'numeric' })} <small>▾</small>
          </button>
          <button class="icon-btn" aria-label="›" onClick={() => (months ? setY(y + 1) : shift(1))}>›</button>
        </div>

        {months ? (
          <div class="cal-months">
            {monthNames.map((n, i) => (
              <button key={i} class={i === m ? 'on' : ''} onClick={() => { setM(i); setMonths(false); }}>{n}</button>
            ))}
          </div>
        ) : (
          <div class="cal-grid">
            {weekdays.map((w, i) => <span key={i} class="wd">{w}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const k = key(y, m, d);
              return (
                <button key={i} disabled={!ok(k)} class={`day${k === value ? ' sel' : ''}${k === today ? ' today' : ''}`} onClick={() => pick(k)}>{d}</button>
              );
            })}
          </div>
        )}

        <div class="cal-quick">
          {quick.filter(([, d]) => ok(d)).map(([label, d]) => <button key={d} class="chip" onClick={() => pick(d)}>{label}</button>)}
          {clearable && value && <button class="chip" onClick={() => { onChange(''); onClose(); }}>{t('clear')}</button>}
        </div>
      </div>
    </div>
  );
}
