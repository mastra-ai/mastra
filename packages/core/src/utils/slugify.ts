import slugifyImport from '@sindresorhus/slugify';

type SlugifyFn = typeof slugifyImport;

/**
 * `@sindresorhus/slugify` is ESM-only, so under CommonJS the bundled output
 * reaches it through the rolldown interop bridge:
 *
 * ```js
 * let mod = require('@sindresorhus/slugify');
 * mod = __toESM(mod, 1); // isNodeMode = 1
 * // ...
 * (0, mod.default)(id);
 * ```
 *
 * With `isNodeMode` set, `__toESM` unconditionally defines `default` as the
 * whole module object, shadowing the namespace's own `default` export. The
 * generated `mod.default` is therefore the namespace, not the callable, and
 * every call site throws `(0 , import_slugify.default) is not a function`.
 *
 * Resolving the callable defensively keeps both module systems working: under
 * ESM the imported binding is already the function, under the CJS bridge we
 * step through the extra `default` hop.
 */
export function resolveSlugify(mod: unknown): SlugifyFn {
  let candidate = mod;
  for (let hops = 0; hops < 2 && candidate && typeof candidate !== 'function'; hops++) {
    candidate = (candidate as { default?: unknown }).default;
  }
  return (typeof candidate === 'function' ? candidate : mod) as SlugifyFn;
}

/** Interop-safe `@sindresorhus/slugify`, callable from both ESM and CommonJS builds. */
export const slugify: SlugifyFn = resolveSlugify(slugifyImport);
