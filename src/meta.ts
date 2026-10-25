import { signal } from '@preact/signals';
import type { MilestoneKind, Plant } from './types';

/** Set from the guide to open the new-plant form with a plant already chosen. */
export const pendingPlant = signal<Partial<Plant> | undefined>(undefined);

export type EventKind = 'plant' | MilestoneKind;

export const KINDS: { kind: EventKind; emoji: string; color: string }[] = [
  { kind: 'plant', emoji: '🪴', color: '#8a6d3b' },
  { kind: 'sprout', emoji: '🌱', color: '#7bc043' },
  { kind: 'bud', emoji: '🌷', color: '#d66aa8' },
  { kind: 'bloom', emoji: '🌸', color: '#e0605c' },
  { kind: 'bloomEnd', emoji: '🥀', color: '#8b6fd6' },
  { kind: 'harvest', emoji: '🧺', color: '#e0a526' },
];

export const kindMeta = (k: EventKind) => KINDS.find((x) => x.kind === k)!;
