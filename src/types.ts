export type Unit = 'day' | 'week' | 'month' | 'year';
export type Lang = 'en' | 'uk';

/** What happened in a plant's life. 'plant' is the planting date and lives on the plant itself. */
export type MilestoneKind = 'sprout' | 'bud' | 'bloom' | 'bloomEnd' | 'harvest';

export interface Plant {
  id: string;
  name: string;
  /** Key from the species guide, if it is one of the known ones. */
  species?: string;
  /** Scientific name picked from the online search, e.g. "Monstera deliciosa". */
  latin?: string;
  /** iNaturalist taxon id of that name. */
  taxonId?: number;
  /** Cultivar / variety (сорт), free text, e.g. "Thai Constellation". */
  variety?: string;
  /** Photo shown on the card; the newest one when empty. */
  cover?: string;
  emoji: string;
  color: string;
  /** Room or windowsill. */
  place?: string;
  /** Planting date, YYYY-MM-DD. */
  plantedOn?: string;
  origin?: 'seed' | 'cutting' | 'bought' | 'gift';
  notes?: string;
  updatedAt: string;
}

/** Sprouted, budded, bloomed, harvested... A plant can have many (blooms come back every year). */
/**
 * A photo of a plant. The pictures themselves are not in the synced data: the full-size one (`id`) and the thumbnail
 * (`thumbId`) live on the phone and, encrypted, in R2.
 */
export interface Photo {
  id: string;
  plantId: string;
  thumbId: string;
  /** When it was taken, YYYY-MM-DD. */
  day: string;
  note?: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  plantId: string;
  kind: MilestoneKind;
  /** YYYY-MM-DD */
  day: string;
  note?: string;
  updatedAt: string;
}

/** A recurring procedure (watering, feeding, pest treatment). The interval counts from the last time it was done. */
export interface Task {
  id: string;
  name: string;
  emoji: string;
  color: string;
  group: 'care' | 'pest';
  every: number;
  unit: Unit;
  /** Start reminding this many days before the due date. */
  lead: number;
  /** Plants it applies to; empty means every plant. */
  plantIds: string[];
  /** Months (1-12) in which it is active, e.g. the heating season; empty means all year. */
  months: number[];
  /** First due date for a plant that has never had it, YYYY-MM-DD. Defaults to today. */
  startDate?: string;
  /** Stops after this many completed treatments (a pest course: 3 times, a week apart). */
  limit?: number;
  /** Which stock preset created it, so the same plan is not added twice. */
  preset?: string;
  notes?: string;
  archived?: boolean;
  order: number;
  updatedAt: string;
}

export interface Log {
  id: string;
  taskId: string;
  plantId: string;
  /** ISO timestamp of when it was done. */
  at: string;
  /** Name of the person who did it (shared households). */
  by?: string;
  note?: string;
  /** Overrides the computed next due date, YYYY-MM-DD. */
  nextDue?: string;
  /** Postponed on purpose: counts for scheduling but not as done. */
  skipped?: boolean;
  updatedAt: string;
}

export interface Settings {
  /** Name shown to the other person next to what you log. */
  me: string;
  lang: Lang;
  theme: 'auto' | 'light' | 'dark';
  accent: string;
  /** Local hour of day for calendar alerts. */
  hour: number;
  plantFilter: string;
  /** Sync server address; empty uses the built-in default. */
  server: string;
  /** This phone is subscribed to server push. */
  push: boolean;
  /** Reminders are on (push, or local while the app is open). */
  notify: boolean;
}

export interface AppState {
  version: 1;
  plants: Plant[];
  milestones: Milestone[];
  photos: Photo[];
  tasks: Task[];
  logs: Log[];
  tombstones: Record<string, string>;
  settings: Settings;
}

export interface SyncData {
  plants: Plant[];
  milestones: Milestone[];
  photos: Photo[];
  tasks: Task[];
  logs: Log[];
  tombstones: Record<string, string>;
}
