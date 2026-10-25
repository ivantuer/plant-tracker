// Service worker: offline cache, plus the reminder that arrives as a push while the app is closed.
// The push carries no data (the server cannot read the household); this worker reads the local copy and writes the message.
import { get } from 'idb-keyval';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { digest } from './digest';
import { translate } from './i18n';
import { STATE_KEY } from './store';
import type { AppState } from './types';

interface Ev { waitUntil(p: Promise<unknown>): void; notification?: { close(): void } }
const sw = self as unknown as {
  registration: ServiceWorkerRegistration;
  clients: { matchAll(o: object): Promise<{ focus(): Promise<unknown>; url: string }[]>; openWindow(u: string): Promise<unknown>; claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: string, fn: (e: Ev) => void): void;
};

// The build tool looks for this exact expression to insert the list of files to cache.
precacheAndRoute((self as unknown as { __WB_MANIFEST: { url: string; revision: string | null }[] }).__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

sw.addEventListener('install', () => void sw.skipWaiting());
sw.addEventListener('activate', (e) => e.waitUntil(sw.clients.claim()));

sw.addEventListener('push', (e) =>
  e.waitUntil(
    (async () => {
      const saved = await get<AppState>(STATE_KEY);
      const lang = saved?.settings.lang ?? 'en';
      const d = saved ? digest(saved, lang) : null;
      // A push must always show something, or the browser shows its own generic notice.
      await sw.registration.showNotification(d ? d.title : translate(lang, 'digest.generic'), {
        body: d?.body,
        tag: 'plant-reminder',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
      } as NotificationOptions);
    })(),
  ),
);

sw.addEventListener('notificationclick', (e) => {
  e.notification?.close();
  e.waitUntil(
    (async () => {
      const wins = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.length) await wins[0].focus();
      else await sw.clients.openWindow('./');
    })(),
  );
});
