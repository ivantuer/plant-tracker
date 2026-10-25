import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromHit } from '../src/pick';
import { SPECIES, speciesForLatin } from '../src/species';
import { searchTaxa } from '../src/taxa';
import { plant } from './helpers';

const RAW = { results: [
  { id: 1, name: 'Monstera', rank: 'genus', preferred_common_name: 'Монстера', default_photo: { square_url: 'https://x/1.jpg' } },
  { id: 2, name: 'Monstera deliciosa', rank: 'species', preferred_common_name: 'Монстера приємна' },
  { id: 3, name: 'Monstera', rank: 'subgenus' },
  { id: 4, name: 'Monstera deliciosa', rank: 'complex' },
  { id: 5, name: 'Rosa', rank: 'section' },
] };

afterEach(() => vi.unstubAllGlobals());

describe('online search', () => {
  it('asks for plants in the interface language and keeps only useful ranks, without duplicates', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(RAW)));
    vi.stubGlobal('fetch', fetchMock);
    const r = await searchTaxa('монстера', 'uk');
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('taxon_id=47126');
    expect(url).toContain('locale=uk');
    expect(url).toContain(encodeURIComponent('монстера'));
    expect(r.map((x) => x.latin)).toEqual(['Monstera', 'Monstera deliciosa']);
    expect(r[0]).toMatchObject({ common: 'Монстера', photo: 'https://x/1.jpg' });
  });

  it('reports a failing service', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(searchTaxa('x', 'en')).rejects.toThrow();
  });
});

describe('picking a result', () => {
  const hit = (latin: string, common?: string) => ({ kind: 'taxon' as const, taxon: { id: 7, latin, rank: 'species', common } });

  it('links a known plant to the guide and names it', () => {
    const p = fromHit(plant('a', { name: '' }), hit('Monstera deliciosa', 'монстера приємна'));
    expect(p).toMatchObject({ latin: 'Monstera deliciosa', taxonId: 7, species: 'monstera', name: 'Монстера приємна', emoji: '🌿' });
  });

  it('keeps a plant without a guide entry as it is, named by its scientific name when there is no common name', () => {
    const p = fromHit(plant('a', { name: '' }), hit('Philodendron hederaceum'));
    expect(p.species).toBeUndefined();
    expect(p.name).toBe('Philodendron hederaceum');
  });

  it('never overwrites a name the user typed, nor the variety', () => {
    const p = fromHit(plant('a', { name: 'Monty', variety: 'Thai Constellation' }), hit('Monstera deliciosa', 'Swiss cheese plant'));
    expect(p.name).toBe('Monty');
    expect(p.variety).toBe('Thai Constellation');
    expect(p.species).toBe('monstera');
  });

  it('matches scientific names to guide plants, most specific first', () => {
    expect(speciesForLatin('Dracaena trifasciata')?.key).toBe('sansevieria');
    expect(speciesForLatin('Dracaena fragrans')?.key).toBe('dracaena');
    expect(speciesForLatin('Ficus benjamina')?.key).toBe('ficus-benjamina');
    expect(speciesForLatin('Ficus pumila')).toBeUndefined();
    expect(speciesForLatin('Phalaenopsis amabilis')?.key).toBe('orchid');
    expect(SPECIES.length).toBeGreaterThan(20);
  });
});
