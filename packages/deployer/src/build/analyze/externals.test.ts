import { describe, expect, it } from 'vitest';
import { DEPRECATED_EXTERNALS, GLOBAL_EXTERNALS } from './constants';
import { normalizeExternals } from './externals';

describe('normalizeExternals', () => {
  it('merges global, deprecated, and user externals in deterministic order without duplicates', () => {
    const userExternal = 'custom-external';
    const duplicateGlobal = GLOBAL_EXTERNALS[0]!;
    const duplicateDeprecated = DEPRECATED_EXTERNALS[0]!;

    expect(normalizeExternals([userExternal, duplicateGlobal, duplicateDeprecated, userExternal])).toEqual({
      externalsPreset: false,
      mergedExternals: [...GLOBAL_EXTERNALS, ...DEPRECATED_EXTERNALS, userExternal],
    });
  });

  it('preserves external-all mode while retaining the normalized external list', () => {
    expect(normalizeExternals(true)).toEqual({
      externalsPreset: true,
      mergedExternals: [...GLOBAL_EXTERNALS, ...DEPRECATED_EXTERNALS],
    });
  });
});
