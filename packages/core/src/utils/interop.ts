/**
 * Read the default export of an ESM-only dependency in a way that also works in
 * the CommonJS build.
 *
 * Node returns the module namespace when CommonJS code requires an ESM-only
 * package. The bundler then applies its ESM interop helper to that namespace and
 * sets `default` to the namespace itself, so the default import is the namespace
 * object instead of the exported value. Calls through such an import throw
 * `<name> is not a function`.
 *
 * Wrap each ESM-only default import with this helper. It returns the value under
 * both module systems, and it also survives a change of the interop shape.
 *
 * @example
 * ```typescript
 * import slugifyModule from '@sindresorhus/slugify';
 * export const slugify = interopDefault(slugifyModule);
 * ```
 */
export function interopDefault<T extends (...args: never[]) => unknown>(moduleExport: T | { default: T }): T {
  return typeof moduleExport === 'function' ? moduleExport : moduleExport.default;
}
