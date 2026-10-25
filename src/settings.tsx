import { useEffect, useRef, useState } from 'preact/hooks';
import { allItems } from './care';
import { localDate } from './dates';
import { t } from './i18n';
import { buildIcs, download } from './ics';
import { disablePush, enableLocalOnly, enablePush, isIos, pushSupported, scheduleUpload, showDigest, standalone, supported } from './push';
import { exportJson, importJson, patchSettings, sharedData, state } from './store';
import { GOOGLE_CLIENT_ID } from './config';
import { renderGoogleButton } from './google';
import { connectGoogle, googleEmail, leaveHousehold, shareWith, sync, syncNow, vault } from './sync';
import type { Lang } from './types';
import { Field, Seg, Sheet, Topbar, showToast } from './ui';

const ACCENTS = ['#3fae6a', '#2bb3a0', '#4a90d9', '#8b6fd6', '#d66aa8', '#e0605c', '#ff7a45', '#e0a526'];

export function Settings() {
  const set = state.value.settings;
  return (
    <>
      <Topbar title={t('tab.settings')} />
      <div class="card">
        <h2>{t('you')}</h2>
        <Field label={t('yourName')} hint={t('yourNameHint')}>
          <input type="text" value={set.me} placeholder={t('yourNamePlaceholder')} onInput={(e) => patchSettings({ me: (e.target as HTMLInputElement).value })} />
        </Field>
      </div>

      <Household />
      <Reminders />

      <div class="card">
        <h2>{t('appearance')}</h2>
        <Field label={t('language')}><Seg<Lang> value={set.lang} options={[['uk', 'Українська'], ['en', 'English']]} onChange={(lang) => patchSettings({ lang })} /></Field>
        <Field label={t('theme')}><Seg value={set.theme} options={(['auto', 'light', 'dark'] as const).map((m) => [m, t(`theme.${m}`)] as [typeof m, string])} onChange={(theme) => patchSettings({ theme })} /></Field>
        <Field label={t('accent')}>
          <div class="swatches">{ACCENTS.map((c) => <button key={c} class={`sw${set.accent === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => patchSettings({ accent: c })} />)}</div>
        </Field>
      </div>

      <Data />
    </>
  );
}

// ---- shared household ------------------------------------------------------------------------------------

export function Household() {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const button = useRef<HTMLDivElement>(null);
  const v = vault.value;
  const st = sync.value;

  // Google's own button signs this device in; the same account then opens the same plants anywhere.
  useEffect(() => {
    if (v || !button.current) return;
    setErr('');
    renderGoogleButton(button.current, GOOGLE_CLIENT_ID, (idToken) => {
      setBusy(true);
      connectGoogle(idToken).catch((e) => setErr((e as Error).message === 'This server belongs to another Google account' ? t('err.owner') : `${t('err.sync')} (${(e as Error).message})`)).finally(() => setBusy(false));
    }).catch(() => setErr(t('err.google')));
  }, [v]);

  const mode = st.error === 'auth' ? 'bad' : st.error ? 'off' : st.live ? 'live' : 'idle';
  const share = async () => {
    setBusy(true); setErr('');
    try { await shareWith(email.trim()); showToast(t('shared', { email: email.trim() })); setEmail(''); } catch { setErr(t('err.sync')); } finally { setBusy(false); }
  };
  return (
    <div class="card">
      <h2>{t('household')}</h2>
      {v ? (
        <>
          <p class="small">
            <span class={`dot ${mode}`}><i />{t(`sync.${mode}`)}</span>
            {st.at > 0 && <span class="muted"> · {t('syncedAt', { time: new Date(st.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>}
          </p>
          {googleEmail.value && <p class="small">{t('signedInAs', { email: googleEmail.value })}</p>}
          {st.error === 'auth' && <p class="error small">{t('err.auth')}</p>}
          <p class="muted small">{t('householdOn')}</p>
          <Field label={t('shareTitle')} hint={t('shareHint')}>
            <div class="row gap">
              <input type="email" value={email} placeholder="name@gmail.com" onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
              <button class="btn" disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => void share()}>{t('share')}</button>
            </div>
          </Field>
          <div class="row gap wrap">
            <button class="btn" disabled={st.busy} onClick={() => void syncNow()}>{t('syncNow')}</button>
            <button class="btn danger" onClick={() => confirm(t('leaveConfirm')) && void leaveHousehold()}>{t('signOut')}</button>
          </div>
        </>
      ) : (
        <>
          <p class="muted small">{t('householdOff')}</p>
          <div ref={button} style={{ minHeight: '44px' }} />
          <p class="hint">{t('googlePrivacy')}</p>
        </>
      )}
      {err && <p class="error small">{err}</p>}
    </div>
  );
}

// ---- reminders -------------------------------------------------------------------------------------------

function Reminders() {
  const set = state.value.settings;
  const [err, setErr] = useState('');
  const perm = supported() ? Notification.permission : 'denied';
  const on = set.notify && perm === 'granted';

  const toggle = async () => {
    setErr('');
    try {
      if (on) { await disablePush(); patchSettings({ notify: false }); return; }
      if (vault.value && pushSupported()) await enablePush();
      else await enableLocalOnly();
    } catch (e) {
      const m = (e as Error).message;
      setErr(m === 'denied' ? t('err.denied') : m === 'vapid' ? t('err.vapid') : `${t('err.sync')} (${m})`);
    }
  };

  return (
    <div class="card">
      <h2>{t('reminders')}</h2>
      {!supported() ? <p class="muted small">{t('noNotifications')}</p> : (
        <>
          <div class="row between">
            <span>{t('notifyMe')}</span>
            <label class="switch"><input type="checkbox" checked={on} onChange={toggle} /><span /></label>
          </div>
          {on && <button class="btn" onClick={async () => { if (!(await showDigest(true))) showToast(t('allGood')); }}>{t('testReminder')}</button>}
          {isIos() && !standalone() && <p class="muted small">{t('iosInstall')}</p>}
          {on && !(vault.value && set.push) && <p class="muted small">{t('localOnly')}</p>}
          {err && <p class="error small">{err}</p>}
        </>
      )}
      <Field label={t('remindAt')} hint={t('remindAtHint')}>
        <select value={set.hour} onChange={(e) => { patchSettings({ hour: Number((e.target as HTMLSelectElement).value) }); scheduleUpload(); }}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
        </select>
      </Field>
      <button class="btn block" onClick={() => download('plant-care.ics', buildIcs(allItems(sharedData()).filter((i) => !i.task.archived), set.hour), 'text/calendar')}>{t('exportIcs')}</button>
      <p class="muted small">{t('icsHint')}</p>
    </div>
  );
}

// ---- data ------------------------------------------------------------------------------------------------

function Data() {
  const backup = () => download(`plant-care-${localDate()}.json`, exportJson(), 'application/json');
  const restore = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    void f.text().then((txt) => {
      try { importJson(txt); showToast(t('imported')); } catch { showToast(t('err.backup')); }
    });
    (e.target as HTMLInputElement).value = '';
  };
  return (
    <div class="card">
      <h2>{t('data')}</h2>
      <div class="row gap wrap">
        <button class="btn" onClick={backup}>{t('exportJson')}</button>
        <label class="btn">{t('importJson')}<input type="file" accept="application/json,.json" hidden onChange={restore} /></label>
      </div>
      <p class="muted small">{t('privacy')}</p>
    </div>
  );
}
