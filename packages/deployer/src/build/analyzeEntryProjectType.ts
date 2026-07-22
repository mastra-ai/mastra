import { readFile } from 'node:fs/promises';
import { transformAsync } from '@babel/core';
import { checkConfigExport } from './babel/check-config-export';

/**
 * Lightweight entry analysis that returns the detected project type by running
 * only the Babel check-config-export plugin on the Mastra entry file. This is
 * intentionally cheaper than `analyzeBundle` and is used by the CLI before
 * `prepare()` clears `.mastra` to decide whether Factory-specific build steps
 * (e.g. `build:ui`) should run.
 *
 * Returns `'software-factory'` when the entry imports `MastraFactory` and
 * constructs it, or `undefined` for ordinary Mastra projects.
 */
export async function analyzeEntryProjectType(mastraEntry: string): Promise<string | undefined> {
  const code = await readFile(mastraEntry, 'utf-8');
  const result: { hasValidConfig: boolean; projectType?: string } = { hasValidConfig: false };

  await transformAsync(code, {
    filename: mastraEntry,
    presets: [import.meta.resolve('@babel/preset-typescript')],
    plugins: [() => checkConfigExport(result)],
  });

  return result.projectType;
}
