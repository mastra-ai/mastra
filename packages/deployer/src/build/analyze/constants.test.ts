import { describe, expect, it } from 'vitest';
import { OPTIONAL_TRY_CATCH_DEPENDENCIES, getConfiguredExternals } from './constants';

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

  it('tracks optional try-catch dependencies separately from configured externals', () => {
    expect(OPTIONAL_TRY_CATCH_DEPENDENCIES).toEqual([
      'bufferutil',
      'utf-8-validate',
      'supports-color',
      'source-map-support',
    ]);
    expect(getConfiguredExternals({ externals: false })).not.toContain('utf-8-validate');
    expect(getConfiguredExternals({ externals: false })).not.toContain('supports-color');
    expect(getConfiguredExternals({ externals: false })).not.toContain('source-map-support');
  });
});
