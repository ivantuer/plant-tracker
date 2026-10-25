// Online plant search (iNaturalist, free, no key). Nothing is stored: results are fetched as you type and only the chosen
// scientific name and id are kept on the plant.
import type { Species } from './species';
import type { Lang } from './types';

export interface Taxon {
  id: number;
  /** Scientific name. */
  latin: string;
  rank: string;
  /** Common name in the interface language when iNaturalist knows one, otherwise in English. */
  common?: string;
  photo?: string;
}

/** A search result: a plant from our guide, or any plant from the online service. */
export type Hit = { kind: 'guide'; species: Species } | { kind: 'taxon'; taxon: Taxon };

const PLANTAE = 47126;
const RANKS = new Set(['species', 'genus', 'hybrid', 'subspecies', 'variety', 'family']);

interface Raw { id: number; name: string; rank: string; preferred_common_name?: string; default_photo?: { square_url?: string } }

export async function searchTaxa(q: string, lang: Lang, signal?: AbortSignal): Promise<Taxon[]> {
  const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(q)}&taxon_id=${PLANTAE}&per_page=12&is_active=true&locale=${lang}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const seen = new Set<string>();
  const out: Taxon[] = [];
  for (const r of ((await res.json()) as { results: Raw[] }).results) {
    const key = `${r.name}|${r.rank}`;
    if (!RANKS.has(r.rank) || seen.has(key) || seen.has(r.name)) continue;
    seen.add(key); seen.add(r.name);
    out.push({ id: r.id, latin: r.name, rank: r.rank, common: r.preferred_common_name, photo: r.default_photo?.square_url });
  }
  return out.slice(0, 8);
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
