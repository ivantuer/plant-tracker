// Text of a reminder. Pure, so the page and the service worker (which wakes up for a push) produce the same wording.
import { allItems, type Item } from './care';
import { taskName, translate } from './i18n';
import type { Lang, SyncData } from './types';

export function digest(d: Pick<SyncData, 'plants' | 'tasks' | 'logs'>, lang: Lang, today?: string): { title: string; body: string; items: Item[] } | null {
  const items = allItems(d, today).filter((i) => i.status !== 'ok');
  if (!items.length) return null;
  const many = d.plants.length > 1;
  const line = (i: Item) => `${i.task.emoji} ${many ? `${i.plant.name}: ` : ''}${taskName(lang, i.task.name)}`;
  const shown = items.slice(0, 4).map(line);
  if (items.length > 4) shown.push(translate(lang, 'digest.more', { n: String(items.length - 4) }));
  return { title: translate(lang, 'digest.title', { n: String(items.length) }), body: shown.join('\n'), items };
}
