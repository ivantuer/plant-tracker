// Reminders. Two layers: a push the server sends at the right time (works with the app closed), and a local
// check that runs whenever the app is open. Both read the same schedule, which comes from the data itself.
import { allItems, reminderTimes } from './care';
import { digest } from './digest';
import { localDate } from './dates';
import { patchSettings, sharedData, state } from './store';
import { afterSync, vault } from './sync';

export const supported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export const pushSupported = () => supported() && 'PushManager' in window;
export const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const toKey = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

const auth = () => ({ Authorization: `Bearer ${vault.value!.bearer}`, 'Content-Type': 'application/json' });

async function registration() {
  return navigator.serviceWorker.ready;
}

/** Sends the server the moments to wake this phone. They are only timestamps; names and plants stay on the devices. */
export async function uploadSchedule() {
  const v = vault.value;
  if (!v || !state.value.settings.push || !pushSupported()) return;
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  const times = reminderTimes(allItems(sharedData()), state.value.settings.hour);
  try {
    await fetch(`${v.url}${v.path}/push`, { method: 'POST', headers: auth(), body: JSON.stringify({ sub: sub.toJSON(), times }) });
  } catch { /* offline: the next sync uploads it again */ }
}

let timer = 0;
export const scheduleUpload = () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => void uploadSchedule(), 3000);
};

/** Asks permission, subscribes this phone to push, and uploads the schedule. Needs a household (the server keys pushes by it). */
export async function enablePush() {
  const v = vault.value;
  if (!v) throw new Error('household');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied');
  const cfg = (await (await fetch(`${v.url}/config`)).json()) as { vapid?: string };
  if (!cfg.vapid) throw new Error('vapid');
  const reg = await registration();
  (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(cfg.vapid) }));
  patchSettings({ push: true, notify: true });
  await uploadSchedule();
}

export async function disablePush() {
  patchSettings({ push: false });
  const v = vault.value;
  if (!pushSupported()) return;
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  if (v) await fetch(`${v.url}${v.path}/push`, { method: 'DELETE', headers: auth(), body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe();
}

/** Without a household there is no server to push from; permission alone still allows reminders while the app is open. */
export async function enableLocalOnly() {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied');
  patchSettings({ notify: true });
}

export async function showDigest(force = false): Promise<boolean> {
  if (!supported() || Notification.permission !== 'granted') return false;
  const { settings } = state.value;
  const d = digest(sharedData(), settings.lang);
  if (!d) return false;
  const today = localDate();
  if (!force) {
    if (!settings.notify || new Date().getHours() < settings.hour) return false;
    try {
      if (localStorage.getItem('pc-notified') === today) return false;
      localStorage.setItem('pc-notified', today);
    } catch { /* private mode: at worst it repeats */ }
  }
  await (await registration()).showNotification(d.title, { body: d.body, tag: 'plant-reminder', icon: 'icon-192.png' } as NotificationOptions);
  return true;
}

/** While the app is open: remind once a day after the chosen hour, and keep the server schedule current. */
export function startReminders() {
  afterSync.run = () => { scheduleUpload(); void showDigest(); };
  setInterval(() => void showDigest(), 15 * 60_000);
  void showDigest();
  scheduleUpload();
}
