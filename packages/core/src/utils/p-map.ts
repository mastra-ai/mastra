type PMapModule = typeof import('p-map');

let pMapModulePromise: Promise<PMapModule> | undefined;

/**
 * Loads the ESM-only `p-map` module without making CommonJS consumers require
 * it while evaluating Mastra's entry point.
 */
export function loadPMap(): Promise<PMapModule> {
  return (pMapModulePromise ??= import('p-map'));
}
