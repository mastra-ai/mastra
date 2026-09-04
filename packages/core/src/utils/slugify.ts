type Slugify = (typeof import('@sindresorhus/slugify'))['default'];

let slugifyPromise: Promise<Slugify> | undefined;

/**
 * Loads the ESM-only `@sindresorhus/slugify` default export without making
 * CommonJS consumers require it while evaluating Mastra's entry point.
 */
export function loadSlugify(): Promise<Slugify> {
  return (slugifyPromise ??= import('@sindresorhus/slugify').then(module => module.default));
}
