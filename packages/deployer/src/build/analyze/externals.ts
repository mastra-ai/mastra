import { DEPRECATED_EXTERNALS, GLOBAL_EXTERNALS } from './constants';

export interface NormalizedExternals {
  externalsPreset: boolean;
  mergedExternals: string[];
}

export function normalizeExternals(externals?: boolean | string[] | null): NormalizedExternals {
  const userExternals = Array.isArray(externals) ? externals : [];

  return {
    externalsPreset: externals === true,
    mergedExternals: [...new Set([...GLOBAL_EXTERNALS, ...DEPRECATED_EXTERNALS, ...userExternals].filter(Boolean))],
  };
}
