import { useState } from 'preact/hooks';
import { allItems } from './care';
import { localDate } from './dates';
import { t } from './i18n';
import { buildIcs, download } from './ics';
import { disablePush, enableLocalOnly, enablePush, isIos, pushSupported, scheduleUpload, showDigest, standalone, supported } from './push';
import { exportJson, importJson, patchSettings, sharedData, state } from './store';
import { createHousehold, joinHousehold, leaveHousehold, newInviteLink, serverUrl, sync, syncNow, vault } from './sync';
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
  const [busy, setBusy] = useState(false);
  const [join, setJoin] = useState('');
  const [err, setErr] = useState('');
  const [invite, setInvite] = useState('');
  const set = state.value.settings;
  const v = vault.value;
  const st = sync.value;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) {
      const m = (e as Error).message;
      setErr(m === 'server' ? t('noServerHint') : m === 'invite' ? t('err.invite') : m === 'used' ? t('err.used') : `${t('err.sync')} (${m})`);
    } finally { setBusy(false); }
  };

  const mode = st.error === 'auth' ? 'bad' : st.error ? 'off' : st.live ? 'live' : 'idle';
  return (
    <div class="card">
      <h2>{t('household')}</h2>
      {v ? (
        <>
          <p class="small">
            <span class={`dot ${mode}`}><i />{t(`sync.${mode}`)}</span>
            {st.at > 0 && <span class="muted"> · {t('syncedAt', { time: new Date(st.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>}
          </p>
          {st.error === 'auth' && <p class="error small">{t('err.auth')}</p>}
          <p class="muted small">{t('householdOn')}</p>
          <div class="row gap wrap">
            <button class="btn primary" disabled={busy} onClick={() => void run(async () => setInvite(await newInviteLink()))}>{t('invitePartner')}</button>
            <button class="btn" disabled={st.busy} onClick={() => void syncNow()}>{t('syncNow')}</button>
            <button class="btn danger" onClick={() => confirm(t('leaveConfirm')) && void leaveHousehold()}>{t('leave')}</button>
          </div>
        </>
      ) : (
        <>
          <p class="muted small">{t('householdOff')}</p>
          <Field label={t('server')} hint={t('serverHint')}>
            <input type="url" value={set.server} placeholder={serverUrl() || 'https://plantcare-sync.you.workers.dev'} onInput={(e) => patchSettings({ server: (e.target as HTMLInputElement).value })} />
          </Field>
          <button class="btn primary block" disabled={busy || !serverUrl()} onClick={() => void run(createHousehold)}>{t('createHousehold')}</button>
          <Field label={t('inviteLink')}><input type="text" value={join} placeholder="https://…#join=…" onInput={(e) => setJoin((e.target as HTMLInputElement).value)} /></Field>
          <button class="btn block" disabled={busy || !join.trim()} onClick={() => void run(() => joinHousehold(join))}>{t('joinHousehold')}</button>
        </>
      )}
      {err && <p class="error small">{err}</p>}
      {invite && <LinkSheet link={invite} onClose={() => setInvite('')} />}
    </div>
  );
}

const mobile = () => /Mobi|iPhone|iPad|Android/i.test(navigator.userAgent);

/** The one-time link, ready to copy. The system share sheet is offered only on phones, where it reaches Messages and mail apps. */
function LinkSheet({ link, onClose }: { link: string; onClose: () => void }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); showToast(t('copied')); } catch { prompt(t('inviteLink'), link); }
  };
  const share = () => void navigator.share({ title: t('app'), text: t('inviteMessage'), url: link }).catch(() => {});
  return (
    <Sheet title={t('invitePartner')} onClose={onClose}>
      <p class="muted small">{t('inviteOnce')}</p>
      <input type="text" readOnly value={link} onFocus={(e) => (e.target as HTMLInputElement).select()} />
      <div class="row gap">
        <button class="btn primary grow" onClick={copy}>{t('copyLink')}</button>
        {mobile() && 'share' in navigator && <button class="btn" onClick={share}>{t('shareLink')}</button>}
      </div>
    </Sheet>
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
