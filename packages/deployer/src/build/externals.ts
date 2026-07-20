import type { Config } from '@mastra/core/mastra';
import { isDependencyPartOfPackage } from './utils';

export type ExternalsOption = NonNullable<Config['bundler']>['externals'];

export type NormalizedExternals = {
  /** `'all'` externalizes every non-workspace dependency. */
  preset: 'all' | 'none';
  /** Always externalized, on top of the preset. */
  include: string[];
  /** Force-bundled even when the preset would externalize them. */
  exclude: string[];
};

/**
 * Collapses every accepted `bundler.externals` form into one shape so downstream
 * code branches on `preset`/`include`/`exclude` instead of re-deriving the union.
 *
 * - `true` -> `{ preset: 'all' }`
 * - `string[]` -> `{ preset: 'none', include }`
 * - object -> passed through with defaults filled in
 */
export function normalizeExternals(externals: ExternalsOption): NormalizedExternals {
  if (externals === true) {
    return { preset: 'all', include: [], exclude: [] };
  }

  if (!externals) {
    return { preset: 'none', include: [], exclude: [] };
  }

  if (Array.isArray(externals)) {
    return { preset: 'none', include: externals.filter(Boolean), exclude: [] };
  }

  return {
    preset: externals.preset ?? 'none',
    include: externals.include?.filter(Boolean) ?? [],
    exclude: externals.exclude?.filter(Boolean) ?? [],
  };
}

/**
 * Whether a dependency should be bundled despite the preset wanting to externalize it.
 *
 * `include` wins over `exclude` so a package the user explicitly asked to externalize
 * can never be pulled back into the bundle. Mastra's own protected externals
 * (GLOBAL_EXTERNALS / DEPRECATED_EXTERNALS) are merged separately and are never
 * routed through here, so `exclude` cannot reach them either.
 */
export function isForceBundled(dep: string, { include, exclude }: NormalizedExternals): boolean {
  if (!exclude.length) return false;
  if (include.some(name => isDependencyPartOfPackage(dep, name))) return false;
  return exclude.some(name => isDependencyPartOfPackage(dep, name));
}
