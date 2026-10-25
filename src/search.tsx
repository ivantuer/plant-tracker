import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { lang, t } from './i18n';
import { SPECIES } from './species';
import { capitalise, searchTaxa, type Hit, type Taxon } from './taxa';

/**
 * A combobox for any plant: type, and our own guide answers first (instant, both languages), then iNaturalist online.
 * Nothing is cached or stored; each keystroke (debounced) asks the service. Arrow keys move, Enter picks, Escape closes.
 * `value` is shown while the user is not typing (the plant already chosen); `onClear` adds a button to forget it.
 */
export function PlantSearch({ onPick, placeholder, value, onClear }: { onPick: (h: Hit) => void; placeholder?: string; value?: string; onClear?: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [taxa, setTaxa] = useState<Taxon[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const run = useRef(0);
  const id = useId();
  const needle = q.trim().toLowerCase();

  const guide = needle.length >= 2 ? SPECIES.filter((s) => s.name.uk.toLowerCase().includes(needle) || s.name.en.toLowerCase().includes(needle)).slice(0, 5) : [];
  const hits: Hit[] = [...guide.map((species) => ({ kind: 'guide', species }) as Hit), ...taxa.map((taxon) => ({ kind: 'taxon', taxon }) as Hit)];

  useEffect(() => {
    if (needle.length < 2) { setTaxa([]); setState('idle'); return; }
    const n = ++run.current;
    const ctl = new AbortController();
    setState('loading');
    const timer = setTimeout(() => {
      searchTaxa(needle, lang.value, ctl.signal)
        .then((r) => { if (n === run.current) { setTaxa(r); setState('idle'); } })
        .catch((e) => { if (n === run.current && (e as Error).name !== 'AbortError') setState('error'); });
    }, 300);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [needle, lang.value]);
  useEffect(() => setActive(0), [needle, taxa.length]);

  const pick = (h: Hit) => { onPick(h); setQ(''); setTaxa([]); setOpen(false); };
  const showList = open && needle.length >= 2;

  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (hits.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length);
    } else if (e.key === 'Enter' && showList && hits[active]) {
      e.preventDefault();
      pick(hits[active]);
    } else if (e.key === 'Escape' && showList) {
      e.stopPropagation(); // closes the list, not the sheet around it
      setOpen(false);
    }
  };

  const label = (h: Hit) => (h.kind === 'guide' ? h.species.name[lang.value] : h.taxon.common ? capitalise(h.taxon.common) : h.taxon.latin);
  return (
    <div class="search">
      <div class="combo">
        <input
          type="text" role="combobox" aria-expanded={showList} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={showList && hits[active] ? `${id}-${active}` : undefined}
          value={open || q ? q : (value ?? '')} placeholder={value ? undefined : (placeholder ?? t('findPlantPlaceholder'))} autocomplete="off" autocapitalize="off" enterkeyhint="search"
          onFocus={(e) => { setOpen(true); if (value) (e.target as HTMLInputElement).select(); }} onBlur={() => setOpen(false)}
          onInput={(e) => { setQ((e.target as HTMLInputElement).value); setOpen(true); }} onKeyDown={key}
        />
        {onClear && value && !q && <button type="button" class="icon-btn combo-clear" aria-label={t('clear')} onMouseDown={(e) => e.preventDefault()} onClick={onClear}>✕</button>}
      </div>
      {showList && (
        <ul class="plain results" role="listbox" id={`${id}-list`} onMouseDown={(e) => e.preventDefault()}>
          {hits.map((h, i) => (
            <li key={h.kind === 'guide' ? h.species.key : h.taxon.id} id={`${id}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" tabIndex={-1} class={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
                {h.kind === 'guide' ? (
                  <><span class="r-ico">{h.species.emoji}</span><span class="r-text"><b>{label(h)}</b><span class="small muted">{t('inGuide')}</span></span></>
                ) : (
                  <><span class="r-ico">{h.taxon.photo ? <img src={h.taxon.photo} alt="" loading="lazy" /> : '🌿'}</span>
                    <span class="r-text"><b>{label(h)}</b><span class="small muted"><i>{h.taxon.latin}</i>{h.taxon.rank === 'genus' ? ` · ${t('rank.genus')}` : h.taxon.rank === 'family' ? ` · ${t('rank.family')}` : ''}</span></span></>
                )}
              </button>
            </li>
          ))}
          {state === 'loading' && <li class="small muted pad">{t('searching')}</li>}
          {state === 'error' && <li class="small error pad">{t('searchOffline')}</li>}
          {state === 'idle' && !hits.length && <li class="small muted pad">{t('noResults')}</li>}
          <li class="small muted pad credit">{t('searchCredit')}</li>
        </ul>
      )}
    </div>
  );
}
