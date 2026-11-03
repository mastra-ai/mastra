import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import {
  createWatcher,
  discoverFsAgents,
  getWatcherInputOptions,
  prepareFsAgentsEntry,
  writeFsAgentsEntry,
} from '@mastra/deployer/build';
import type {
  DiscoveredFsAgent,
  PrepareFsAgentsEntryResult,
  RolldownPluginOption,
  RolldownWatcherEvent,
} from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';

import { devLogger } from '../../utils/dev-logger.js';
import { shouldSkipDotenvLoading } from '../utils.js';

interface FsRoutingWatchOptions {
  mastraDir: string;
  userEntryFile: string | undefined;
  outputDirectory: string;
  preparedEntry: PrepareFsAgentsEntryResult;
}

/**
 * Files whose contents are inlined into the generated fs-agents module rather
 * than imported by it. Rolldown can't see them through the module graph, so the
 * dev watcher has to register them explicitly or edits won't trigger a rebuild.
 */
function collectInlinedPaths(agents: DiscoveredFsAgent[]): string[] {
  return agents.flatMap(agent => [
    ...(agent.instructionsPath ? [agent.instructionsPath] : []),
    ...(agent.schedules ?? []).flatMap(schedule => (schedule.kind === 'markdown' ? [schedule.path] : [])),
    ...collectInlinedPaths(agent.subagents),
  ]);
}

export class DevBundler extends Bundler {
  private customEnvFile?: string;
  private factory: boolean;
  /** Resolved `bundler.sourcemap`, set by {@link watch}. */
  sourcemapEnabled = false;

  constructor(customEnvFile?: string, factory = false) {
    super('Dev');
    this.customEnvFile = customEnvFile;
    this.factory = factory;
    // Use 'neutral' platform for Bun to preserve Bun-specific globals, 'node' otherwise
    this.platform = process.versions?.bun ? 'neutral' : 'node';
  }

  getEnvFiles(): Promise<string[]> {
    // Skip loading .env files if MASTRA_SKIP_DOTENV is set
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

    const possibleFiles = ['.env', '.env.local', '.env.development'];
    if (this.customEnvFile) {
      const customEnvFiles = new FileService().getExistingFiles([this.customEnvFile]);
      if (customEnvFiles.length > 0) return Promise.resolve(customEnvFiles);
    }

    return Promise.resolve(new FileService().getExistingFiles(possibleFiles));
  }

  async prepare(outputDirectory: string): Promise<void> {
    // Preserve the dev lock across super.prepare(), which calls emptyDir()
    const lockPath = join(outputDirectory, 'dev.lock');
    let lockContents: string | null = null;
    try {
      lockContents = await readFile(lockPath, 'utf-8');
    } catch {
      // No lock file — nothing to preserve
    }

    await super.prepare(outputDirectory);

    if (lockContents) {
      try {
        await writeFile(lockPath, lockContents, 'utf-8');
      } catch {
        // Best-effort — don't block dev startup
      }
    }

    if (!this.factory) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const studioServePath = join(outputDirectory, this.outputDir, 'studio');
      await fsExtra.copy(join(dirname(__dirname), join('dist', 'studio')), studioServePath, {
        overwrite: true,
      });
    }
  }

  async watch(
    entryFile: string,
    outputDirectory: string,
    toolsPaths: (string | string[])[],
    fsRoutingWatchOptions?: FsRoutingWatchOptions,
  ): ReturnType<typeof createWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const envFiles = await this.getEnvFiles();
    const bundlerOptions = await this.getUserBundlerOptions(entryFile, outputDirectory);
    const sourcemapEnabled = !!bundlerOptions?.sourcemap;
    this.sourcemapEnabled = sourcemapEnabled;

    const devServerAnalysisEntry = `
      import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
      import { createNodeServer, getToolExports } from '#server';
      export { scoreTracesWorkflow, createNodeServer, getToolExports };
    `;
    // Tool files aren't reachable from the entry, so analyze them too; otherwise workspace
    // packages lose exports that only tools import.
    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths);
    const inputOptions = await getWatcherInputOptions(
      entryFile,
      this.platform,
      {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      {
        sourcemap: sourcemapEnabled,
        analysisEntries: [entryFile, devServerAnalysisEntry, ...Object.values(toolsInputOptions)],
        outputDir: join(outputDirectory, this.analyzeOutputDir),
      },
    );

    const outputDir = join(outputDirectory, this.outputDir);

    await this.writePackageJson(outputDir, new Map(), {});

    let lastFsAgentsModuleSource = fsRoutingWatchOptions?.preparedEntry.moduleSource;

    const watcher = await createWatcher(
      {
        ...inputOptions,
        logLevel: inputOptions.logLevel === 'silent' ? 'warn' : inputOptions.logLevel,
        checks: { ...inputOptions.checks, circularDependency: true },
        onLog: (level, log, defaultHandler) => {
          if (level !== 'warn') {
            defaultHandler(level, log);
            return;
          }

          // Like the previous `onwarn`, only circular dependencies are surfaced. Rolldown's
          // message carries ANSI codes and a `[CODE]` prefix, so the chain is rebuilt from `ids`.
          if (log.code !== 'CIRCULAR_DEPENDENCY' || !log.ids?.length) {
            return;
          }

          if (log.ids.every(id => id.includes('node_modules'))) {
            return;
          }

          this.logger.warn('Circular dependency found', {
            dependency: log.ids.map(id => relative(process.cwd(), id)).join(' -> '),
          });
        },
        plugins: [
          ...(inputOptions.plugins as RolldownPluginOption[]),
          {
            name: 'env-watcher',
            buildStart() {
              for (const envFile of envFiles) {
                this.addWatchFile(resolve(envFile));
              }
            },
          },
          {
            name: 'fs-routing-watcher',
            async buildStart() {
              if (!fsRoutingWatchOptions?.preparedEntry.moduleSource) {
                return;
              }

              const agents = await discoverFsAgents(fsRoutingWatchOptions.mastraDir);
              for (const inlinedPath of collectInlinedPaths(agents)) {
                this.addWatchFile(resolve(inlinedPath));
              }

              const nextEntry = await prepareFsAgentsEntry(
                fsRoutingWatchOptions.mastraDir,
                fsRoutingWatchOptions.userEntryFile,
                fsRoutingWatchOptions.outputDirectory,
              );
              if (nextEntry.moduleSource !== lastFsAgentsModuleSource) {
                await writeFsAgentsEntry(nextEntry);
                lastFsAgentsModuleSource = nextEntry.moduleSource;
              }
            },
          },
          {
            name: 'tools-watcher',
            async buildEnd() {
              const toolImports: string[] = [];
              const toolsExports: string[] = [];
              Array.from(Object.keys(toolsInputOptions || {}))
                .filter(key => key.startsWith('tools/'))
                .forEach((key, index) => {
                  const toolExport = `tool${index}`;
                  toolImports.push(`import * as ${toolExport} from './${key}.mjs';`);
                  toolsExports.push(toolExport);
                });

              await writeFile(
                join(outputDir, 'tools.mjs'),
                `${toolImports.join('\n')}

                export const tools = [${toolsExports.join(', ')}]`,
              );
            },
          },
        ],
        input: {
          index: join(__dirname, 'templates', this.factory ? 'factory-dev.entry.js' : 'dev.entry.js'),
          ...toolsInputOptions,
        },
      },
      {
        dir: outputDir,
        sourcemap: sourcemapEnabled,
      },
    );

    devLogger.info('Preparing development environment...');
    return new Promise((resolve, reject) => {
      let settled = false;
      // Rolldown iterates its listener array while awaiting each listener, and `off()` splices
      // that array, so removing `cb` synchronously (or in a microtask) skips the next listener.
      const settle = () => {
        settled = true;
        setImmediate(() => watcher.off('event', cb));
      };

      const cb = (event: RolldownWatcherEvent) => {
        if (settled) {
          return;
        }

        if (event.code === 'BUNDLE_END') {
          devLogger.success('Initial bundle complete');
          settle();
          resolve(watcher);
        }

        if (event.code === 'ERROR') {
          console.info(event);
          devLogger.error('Bundling failed - check console for details');
          settle();
          reject(event);
        }
      };

      watcher.on('event', cb);
    });
  }

  async bundle(): Promise<void> {
    // Do nothing
  }
}
