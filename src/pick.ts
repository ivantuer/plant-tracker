// Turns a chosen search result (or guide plant) into plant fields. Pure, so it is tested without a browser.
import { lang } from './i18n';
import { speciesByKey, speciesForLatin } from './species';
import { capitalise, type Hit } from './taxa';
import type { Plant } from './types';

/** What to fill in when a guide species is chosen. */
export const presetFromSpecies = (key: string): Partial<Plant> => {
  const s = speciesByKey(key);
  return s ? { species: key, emoji: s.emoji, name: s.name[lang.value] } : {};
};

/** Applies a search result to a plant. The name is replaced only if the user has not typed their own. */
export function fromHit(x: Plant, h: Hit): Plant {
  const guide = speciesByKey(x.species);
  const replaceName = !x.name.trim() || x.name === x.latin || x.name === guide?.name.uk || x.name === guide?.name.en;
  if (h.kind === 'guide') return { ...x, species: h.species.key, emoji: h.species.emoji, ...(replaceName ? { name: h.species.name[lang.value] } : {}) };
  const sp = speciesForLatin(h.taxon.latin);
  const name = h.taxon.common ? capitalise(h.taxon.common) : h.taxon.latin;
  return { ...x, latin: h.taxon.latin, taxonId: h.taxon.id, species: sp?.key, ...(sp ? { emoji: sp.emoji } : {}), ...(replaceName ? { name } : {}) };
}
