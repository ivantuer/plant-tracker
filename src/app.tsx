import { effect } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { Calendar } from './calendar';
import { Guide } from './guide';
import { lang, t, taskName } from './i18n';
import { pendingSpecies } from './meta';
import { Plants } from './plants';
import { Settings } from './settings';
import { patchSettings, ready, state } from './store';
import { joinHousehold, partner, pendingInvite, vault } from './sync';
import { Today } from './today';
import { Sheet, Toast, showToast } from './ui';

type Tab = 'today' | 'plants' | 'calendar' | 'guide' | 'settings';

const ICONS: Record<Tab, string> = {
  today: 'M12 3a9 9 0 100 18 9 9 0 000-18zm-1.2 13.4L6.6 12.2l1.4-1.4 2.8 2.8 5.2-5.2 1.4 1.4z',
  plants: 'M12 22v-9m0 0c0-4 3-7 8-7 0 5-3 8-8 7zm0 0c0-3-2-6-7-6 0 4 2 7 7 6z',
  calendar: 'M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2zM5 9h14v11H5z',
  guide: 'M5 3h11a3 3 0 013 3v15H8a3 3 0 01-3-3zm3 2v11h9V6a1 1 0 00-1-1zm0 13a1 1 0 000 2h9v-2z',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zm8.4 5.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 01-1.7 1l-.3 2h-4l-.3-2a7 7 0 01-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 010-2L3.6 10.3l2-3.4 1.9.7a7 7 0 011.7-1l.3-2h4l.3 2a7 7 0 011.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 010 2z',
};

// Theme, accent and language live in the settings; mirror them onto the page whenever they change.
effect(() => {
  const s = state.value.settings;
  lang.value = s.lang;
  const root = document.documentElement;
  if (s.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  root.style.setProperty('--accent', s.accent);
  root.lang = s.lang;
});

export function App() {
  const [tab, setTab] = useState<Tab>('today');

  useEffect(() => {
    partner.onLogs = (logs) => {
      const { tasks, plants } = state.value;
      const l = logs[0];
      const task = tasks.find((x) => x.id === l.taskId);
      const plant = plants.find((x) => x.id === l.plantId);
      if (task && plant) showToast(`${l.by ?? '?'}: ${task.emoji} ${taskName(lang.value, task.name)} · ${plant.name}${logs.length > 1 ? ` +${logs.length - 1}` : ''}`);
    };
  }, []);

  if (!ready.value) return null;
  // The guide hands over a species to add; show the plants tab, which opens the form.
  const shown: Tab = pendingSpecies.value !== undefined ? 'plants' : tab;
  return (
    <div class="shell">
      <div class="aurora" aria-hidden="true"><i /><i /><i /></div>
      <main class="scroll">
        {shown === 'today' && <Today goPlants={() => setTab('plants')} />}
        {shown === 'plants' && <Plants />}
        {shown === 'calendar' && <Calendar />}
        {shown === 'guide' && <Guide goPlants={() => setTab('plants')} />}
        {shown === 'settings' && <Settings />}
      </main>
      <nav class="tabs">
        {(Object.keys(ICONS) as Tab[]).map((k) => (
          <button key={k} class={shown === k ? 'on' : ''} onClick={() => { pendingSpecies.value = undefined; setTab(k); }} aria-current={shown === k ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={ICONS[k]} fill={k === 'plants' ? 'none' : 'currentColor'} stroke={k === 'plants' ? 'currentColor' : 'none'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>{t(`tab.${k}`)}</span>
          </button>
        ))}
      </nav>
      <Toast />
      {pendingInvite.value && !vault.value && <InviteSheet />}
    </div>
  );
}

/** An invite link opened on this device: confirm before merging its data into the shared household. */
function InviteSheet() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const me = state.value.settings.me;
  const join = async () => {
    setBusy(true);
    try { await joinHousehold(pendingInvite.value); pendingInvite.value = ''; } catch (e) { setErr((e as Error).message === 'used' ? t('err.used') : t('err.sync')); } finally { setBusy(false); }
  };
  return (
    <Sheet title={t('invited')} onClose={() => (pendingInvite.value = '')}>
      <p class="muted">{t('invitedText')}</p>
      {!me && <input type="text" placeholder={t('yourNamePlaceholder')} onInput={(e) => patchSettings({ me: (e.target as HTMLInputElement).value })} />}
      {err && <p class="error small">{err}</p>}
      <button class="btn primary block" disabled={busy || !state.value.settings.me.trim()} onClick={join}>{t('joinHousehold')}</button>
    </Sheet>
  );
}
