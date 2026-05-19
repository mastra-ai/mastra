import { describe, expect, it } from 'vitest';
import type { ListProvider } from '../to-providers';
import { toProviders } from '../to-providers';

const baseProvider: ListProvider = {
  id: 'openai',
  name: 'openai',
  label: 'OpenAI',
  description: 'OpenAI provider',
  models: ['gpt-4o', 'gpt-4o-mini'],
} as never;

describe('toProviders', () => {
  it('maps the source provider fields onto the target Provider shape', () => {
    const [result] = toProviders([baseProvider]);

    expect(result.id).toBe('openai');
    expect(result.name).toBe('openai');
    expect((result as unknown as { label: string }).label).toBe('OpenAI');
    expect((result as unknown as { description: string }).description).toBe('OpenAI provider');
    expect(result.models).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('sets envVar to an empty string and connected to false', () => {
    const [result] = toProviders([baseProvider]);

    expect(result.envVar).toBe('');
    expect(result.connected).toBe(false);
  });

  it('defaults models to an empty array when missing', () => {
    const [result] = toProviders([{ ...baseProvider, models: undefined as never }]);

    expect(result.models).toEqual([]);
  });

  it('returns an empty array when given no providers', () => {
    expect(toProviders([])).toEqual([]);
  });

  it('preserves the order of input providers', () => {
    const result = toProviders([
      { ...baseProvider, id: 'a', name: 'a' },
      { ...baseProvider, id: 'b', name: 'b' },
      { ...baseProvider, id: 'c', name: 'c' },
    ]);

    expect(result.map(p => p.id)).toEqual(['a', 'b', 'c']);
  });
});
