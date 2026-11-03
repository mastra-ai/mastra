import { readFile } from 'node:fs/promises';
import { transformAsync } from '@babel/core';
import type { InputOptions } from '@babel/core';
import { checkConfigExport } from './babel/check-config-export';

export type MastraConfigExportResult = { hasValidConfig: boolean; projectType?: string };

type ParserPlugins = NonNullable<NonNullable<InputOptions['parserOpts']>['plugins']>;

function parserPlugins(filename: string): ParserPlugins {
  if (/\.tsx$/.test(filename)) {
    return ['typescript', 'jsx'];
  }
  if (/\.[cm]?ts$/.test(filename)) {
    return ['typescript'];
  }
  if (/\.jsx$/.test(filename)) {
    return ['jsx'];
  }
  return [];
}

/**
 * Runs the check-config-export Babel plugin on the Mastra entry. Only analyzes the code: TypeScript is parsed, not
 * transformed, and the user's own Babel config files are ignored (they could name presets that aren't installed).
 */
export async function checkMastraConfigExport(mastraEntry: string): Promise<MastraConfigExportResult> {
  const code = await readFile(mastraEntry, 'utf-8');
  const result: MastraConfigExportResult = { hasValidConfig: false };

  await transformAsync(code, {
    filename: mastraEntry,
    babelrc: false,
    configFile: false,
    code: false,
    parserOpts: { plugins: parserPlugins(mastraEntry) },
    plugins: [() => checkConfigExport(result)],
  });

  return result;
}

/**
 * Lightweight entry analysis that returns the detected project type by running
 * only the Babel check-config-export plugin on the Mastra entry file. This is
 * intentionally cheaper than `analyzeBundle` and is used by the CLI before
 * `prepare()` clears `.mastra` to decide whether Factory-specific assets
 * should be copied.
 *
 * Returns `'factory'` when the entry imports `MastraFactory` and
 * constructs it, or `undefined` for ordinary Mastra projects.
 */
export async function analyzeEntryProjectType(mastraEntry: string): Promise<string | undefined> {
  return (await checkMastraConfigExport(mastraEntry)).projectType;
}
