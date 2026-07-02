import { describe, expect, it } from 'vitest';
import { getConfiguredExternals } from './constants';

describe('getConfiguredExternals', () => {
  it('uses global externals when no explicit externals value is provided', () => {
    expect(getConfiguredExternals({})).toContain('bufferutil');
  });

  it('disables global externals when externals is explicitly false', () => {
    expect(getConfiguredExternals({ externals: false })).toEqual([]);
  });

  it('includes deprecated externals only when requested', () => {
    expect(getConfiguredExternals({ externals: [] })).not.toContain('jsdom');
    expect(getConfiguredExternals({ externals: [], includeDeprecated: true })).toContain('jsdom');
  });
});
