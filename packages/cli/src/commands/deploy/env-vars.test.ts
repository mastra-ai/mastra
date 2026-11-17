import { describe, expect, it } from 'vitest';

import { getOverwrittenEnvKeys } from './env-vars.js';

describe('getOverwrittenEnvKeys', () => {
  it('returns empty when the environment has no stored env vars', () => {
    expect(getOverwrittenEnvKeys(null, { API_KEY: 'a' })).toEqual([]);
    expect(getOverwrittenEnvKeys(undefined, { API_KEY: 'a' })).toEqual([]);
    expect(getOverwrittenEnvKeys({}, { API_KEY: 'a' })).toEqual([]);
  });

  it('ignores keys that are new to the environment', () => {
    expect(getOverwrittenEnvKeys({ EXISTING: 'x' }, { NEW: 'y' })).toEqual([]);
  });

  it('ignores keys whose value is unchanged', () => {
    expect(getOverwrittenEnvKeys({ API_KEY: 'same' }, { API_KEY: 'same' })).toEqual([]);
  });

  it('reports keys whose stored value would change', () => {
    expect(getOverwrittenEnvKeys({ API_KEY: 'old', KEEP: 'same' }, { API_KEY: 'new', KEEP: 'same', NEW: 'z' })).toEqual(
      ['API_KEY'],
    );
  });

  it('returns overwritten keys sorted alphabetically', () => {
    const existing = { B_KEY: '1', A_KEY: '1', C_KEY: '1' };
    const incoming = { B_KEY: '2', A_KEY: '2', C_KEY: '2' };
    expect(getOverwrittenEnvKeys(existing, incoming)).toEqual(['A_KEY', 'B_KEY', 'C_KEY']);
  });

  it('reports a real value replacing a hidden write-only secret', () => {
    expect(getOverwrittenEnvKeys({ API_KEY: '__mastra_secret__' }, { API_KEY: 'new-value' })).toEqual(['API_KEY']);
  });

  it('ignores a placeholder sent for a hidden write-only secret', () => {
    expect(getOverwrittenEnvKeys({ API_KEY: '__mastra_secret__' }, { API_KEY: '__mastra_secret__' })).toEqual([]);
  });

  it('ignores incoming placeholders, which keep the stored value', () => {
    expect(getOverwrittenEnvKeys({ API_KEY: 'stored' }, { API_KEY: '__mastra_secret__' })).toEqual([]);
  });
});
