import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { slash } from '../utils';
import { generateFsAgentsModule } from './codegen';
import { discoverFsAgents } from './discover';

export interface PrepareFsAgentsEntryResult {
  /**
   * The entry file that should be fed to the bundler/analyzer. When fs-routed
   * agents are found this is a generated wrapper module that registers them onto
   * the user's mastra instance; otherwise it is the original entry unchanged.
   */
  entryFile: string;
  /**
   * Glob tool paths for tools defined under `agents/*\/tools` so they are
   * bundled alongside the top-level `tools/` directory.
   */
  toolPaths: string[];
  /** Number of fs-routed agents discovered. */
  agentCount: number;
  /**
   * Generated wrapper source to write to {@link entryFile}, or `undefined` when
   * there are no fs-routed agents. The write is deferred so callers can run it
   * *after* `bundler.prepare()` empties the output directory — otherwise the
   * wrapper is wiped before the bundler reads it.
   */
  moduleSource?: string;
}

/**
 * Discover fs-routed agents under `<mastraDir>/agents/*` and, if any exist,
 * generate a wrapper entry module that registers them onto the user's mastra
 * instance. Returns the entry the bundler should use plus extra tool glob paths
 * so `agents/*\/tools` are bundled.
 *
 * This does NOT write the wrapper to disk; call {@link writeFsAgentsEntry} with
 * the result after `bundler.prepare()` so the generated file is not wiped when
 * the output directory is emptied.
 *
 * When no fs-routed agents are present the original entry is returned unchanged,
 * so existing code-only projects are completely unaffected.
 */
export async function prepareFsAgentsEntry(
  mastraDir: string,
  entryFile: string,
  outputDirectory: string,
): Promise<PrepareFsAgentsEntryResult> {
  const agents = await discoverFsAgents(mastraDir);

  if (agents.length === 0) {
    return { entryFile, toolPaths: [], agentCount: 0 };
  }

  const moduleSource = await generateFsAgentsModule(slash(entryFile), agents);
  const generatedEntry = join(outputDirectory, '.mastra-fs-agents-entry.mjs');

  const normalizedMastraDir = slash(mastraDir);
  const toolPaths = [
    posix.join(normalizedMastraDir, 'agents/*/tools/**/*.{js,ts}'),
    `!${posix.join(normalizedMastraDir, 'agents/*/tools/**/*.{test,spec}.{js,ts}')}`,
    `!${posix.join(normalizedMastraDir, 'agents/*/tools/**/__tests__/**')}`,
  ];

  return { entryFile: generatedEntry, toolPaths, agentCount: agents.length, moduleSource };
}

/**
 * Write the generated fs-agents wrapper produced by {@link prepareFsAgentsEntry}
 * to its `entryFile`. No-op when there are no fs-routed agents. Call this AFTER
 * `bundler.prepare()` (which empties the output directory) so the wrapper
 * survives for the bundler/watcher to read.
 */
export async function writeFsAgentsEntry(result: PrepareFsAgentsEntryResult): Promise<void> {
  if (!result.moduleSource) {
    return;
  }

  await mkdir(dirname(result.entryFile), { recursive: true });
  await writeFile(result.entryFile, result.moduleSource, 'utf-8');
}
