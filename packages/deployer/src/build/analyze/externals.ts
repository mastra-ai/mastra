import { isDependencyPartOfPackage } from '../utils';
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

const DEFAULT_EXTERNALS = new Set([...GLOBAL_EXTERNALS, ...DEPRECATED_EXTERNALS]);

/** Whether `dep` matches an entry the user added to `bundler.externals`, as opposed to a built-in default external. */
export function isUserListedExternal(dep: string, mergedExternals: string[]): boolean {
  return mergedExternals.some(external => !DEFAULT_EXTERNALS.has(external) && isDependencyPartOfPackage(dep, external));
}
