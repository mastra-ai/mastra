import { mkdir, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
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
}

/**
 * Discover fs-routed agents under `<mastraDir>/agents/*` and, if any exist,
 * generate a wrapper entry module (written under `<outputDirectory>`) that
 * registers them onto the user's mastra instance. Returns the entry the bundler
 * should use plus extra tool glob paths so `agents/*\/tools` are bundled.
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

  await mkdir(outputDirectory, { recursive: true });
  const generatedEntry = join(outputDirectory, '.mastra-fs-agents-entry.mjs');
  await writeFile(generatedEntry, moduleSource, 'utf-8');

  const normalizedMastraDir = slash(mastraDir);
  const toolPaths = [
    posix.join(normalizedMastraDir, 'agents/*/tools/**/*.{js,ts}'),
    `!${posix.join(normalizedMastraDir, 'agents/*/tools/**/*.{test,spec}.{js,ts}')}`,
    `!${posix.join(normalizedMastraDir, 'agents/*/tools/**/__tests__/**')}`,
  ];

  return { entryFile: generatedEntry, toolPaths, agentCount: agents.length };
}
