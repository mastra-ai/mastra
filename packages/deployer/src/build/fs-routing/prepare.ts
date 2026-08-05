import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { slash } from '../utils';
import { generateFsAgentsModule } from './codegen';
import { discoverFsAgents, discoverFsSingleton, discoverFsWorkflows } from './discover';

export interface PrepareFsAgentsEntryResult {
  /**
   * The entry file that should be fed to the bundler/analyzer. When fs-routed
   * primitives (agents, workflows, storage, observability, logger, server,
   * studio) are
   * found this is a generated wrapper module that registers them onto the
   * user's mastra instance; otherwise it is the original entry unchanged.
   * When auto-constructing (no user entry), this is always the generated module.
   */
  entryFile: string;
  /** Whether a standalone Mastra instance was auto-constructed (no index.ts). */
  standalone: boolean;
  /**
   * Glob tool paths for tools defined under `agents/*\/tools` so they are
   * bundled alongside the top-level `tools/` directory.
   */
  toolPaths: string[];
  /** Number of fs-routed agents discovered. */
  agentCount: number;
  /** Number of fs-routed workflows discovered. */
  workflowCount: number;
  /** Whether a `storage.ts` singleton was discovered. */
  hasStorage: boolean;
  /** Whether an `observability.ts` singleton was discovered. */
  hasObservability: boolean;
  /** Whether a `logger.ts` singleton was discovered. */
  hasLogger: boolean;
  /** Whether a `server.ts` singleton was discovered. */
  hasServer: boolean;
  /** Whether a `studio.ts` singleton was discovered. */
  hasStudio: boolean;
  /**
   * Generated wrapper source to write to {@link entryFile}, or `undefined` when
   * there are no fs-routed primitives. The write is deferred so callers can run
   * it *after* `bundler.prepare()` empties the output directory — otherwise the
   * wrapper is wiped before the bundler reads it.
   */
  moduleSource?: string;
}

/**
 * Discover fs-routed agents under `<mastraDir>/agents/*`, workflows under
 * `<mastraDir>/workflows/`, and singleton config files (e.g. `storage.ts`,
 * `observability.ts`, `logger.ts`, `server.ts`, `studio.ts`).
 * When any are found, generate a wrapper entry module that registers them onto
 * the user's mastra instance. Returns the entry the bundler should use plus
 * extra tool glob paths so `agents/*\/tools` are bundled.
 *
 * This does NOT write the wrapper to disk; call {@link writeFsAgentsEntry} with
 * the result after `bundler.prepare()` so the generated file is not wiped when
 * the output directory is emptied.
 *
 * When `entryFile` is `undefined` (no `index.ts`/`index.js`) and fs-routed
 * primitives are found, a standalone Mastra instance is auto-constructed from
 * them — no user code required.
 *
 * When no fs-routed primitives are present the original entry is returned
 * unchanged, so existing code-only projects are completely unaffected.
 */
export async function prepareFsAgentsEntry(
  mastraDir: string,
  entryFile: string | undefined,
  outputDirectory: string,
): Promise<PrepareFsAgentsEntryResult> {
  const [agents, workflows, storage, observability, logger, server, studio] = await Promise.all([
    discoverFsAgents(mastraDir),
    discoverFsWorkflows(mastraDir),
    discoverFsSingleton(mastraDir, 'storage'),
    discoverFsSingleton(mastraDir, 'observability'),
    discoverFsSingleton(mastraDir, 'logger'),
    discoverFsSingleton(mastraDir, 'server'),
    discoverFsSingleton(mastraDir, 'studio'),
  ]);

  const standalone = entryFile === undefined;
  const hasFsPrimitives =
    agents.length > 0 || workflows.length > 0 || !!storage || !!observability || !!logger || !!server || !!studio;

  if (!hasFsPrimitives && entryFile !== undefined) {
    return {
      entryFile,
      standalone: false,
      toolPaths: [],
      agentCount: 0,
      workflowCount: 0,
      hasStorage: false,
      hasObservability: false,
      hasLogger: false,
      hasServer: false,
      hasStudio: false,
    };
  }

  if (!hasFsPrimitives && standalone) {
    throw new Error(
      'No index.ts and no file-based primitives found. ' +
        'Create src/mastra/index.ts with a Mastra instance, or add file-based agents/workflows/storage.',
    );
  }

  const moduleSource = await generateFsAgentsModule(entryFile ? slash(entryFile) : undefined, agents, {
    workflows,
    storage,
    observability,
    logger,
    server,
    studio,
  });
  const generatedEntry = join(outputDirectory, '.mastra-fs-agents-entry.mjs');

  const normalizedMastraDir = slash(mastraDir);
  const toolPaths =
    agents.length > 0
      ? [
          posix.join(normalizedMastraDir, 'agents/*/tools/**/*.{js,ts}'),
          `!${posix.join(normalizedMastraDir, 'agents/*/tools/**/*.{test,spec}.{js,ts}')}`,
          `!${posix.join(normalizedMastraDir, 'agents/*/tools/**/__tests__/**')}`,
        ]
      : [];

  return {
    entryFile: generatedEntry,
    standalone,
    toolPaths,
    agentCount: agents.length,
    workflowCount: workflows.length,
    hasStorage: !!storage,
    hasObservability: !!observability,
    hasLogger: !!logger,
    hasServer: !!server,
    hasStudio: !!studio,
    moduleSource,
  };
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
