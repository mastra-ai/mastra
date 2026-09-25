import { DEPRECATED_EXTERNALS, GLOBAL_EXTERNALS } from './constants';

export interface NormalizedExternals {
  externalsPreset: boolean;
  mergedExternals: string[];
}

export function normalizeExternals(externals?: boolean | string[] | null, defaultPreset = false): NormalizedExternals {
  const explicitExternals = Array.isArray(externals) ? externals : [];

  return {
    externalsPreset: externals === true || (defaultPreset && externals !== false),
    mergedExternals: [...new Set([...GLOBAL_EXTERNALS, ...DEPRECATED_EXTERNALS, ...explicitExternals].filter(Boolean))],
  };
}
