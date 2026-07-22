import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import {
  createWatcher,
  discoverFsAgents,
  getWatcherInputOptions,
  prepareFsAgentsEntry,
  writeFsAgentsEntry,
} from '@mastra/deployer/build';
import type { DiscoveredFsAgent, PrepareFsAgentsEntryResult } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import type { InputPluginOption, RollupWatcherEvent } from 'rollup';

import { devLogger } from '../../utils/dev-logger.js';
import { shouldSkipDotenvLoading } from '../utils.js';

interface FsRoutingWatchOptions {
  mastraDir: string;
  userEntryFile: string | undefined;
  outputDirectory: string;
  preparedEntry: PrepareFsAgentsEntryResult;
}

function collectInstructionPaths(agents: DiscoveredFsAgent[]): string[] {
  return agents.flatMap(agent => [
    ...(agent.instructionsPath ? [agent.instructionsPath] : []),
    ...collectInstructionPaths(agent.subagents),
  ]);
}

export class DevBundler extends Bundler {
  private customEnvFile?: string;
  private factory: boolean;

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

    const possibleFiles = ['.env.development', '.env.local', '.env'];
    if (this.customEnvFile) {
      possibleFiles.unshift(this.customEnvFile);
    }

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch {
      // ignore
    }

    return Promise.resolve([]);
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

    const devServerAnalysisEntry = `
      import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
      import { createNodeServer, getToolExports } from '#server';
      export { scoreTracesWorkflow, createNodeServer, getToolExports };
    `;
    const inputOptions = await getWatcherInputOptions(
      entryFile,
      this.platform,
      {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      {
        sourcemap: sourcemapEnabled,
        analysisEntries: [entryFile, devServerAnalysisEntry],
      },
    );
    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths);

    const outputDir = join(outputDirectory, this.outputDir);

    await this.writePackageJson(outputDir, new Map(), {});

    let lastFsAgentsModuleSource = fsRoutingWatchOptions?.preparedEntry.moduleSource;

    const watcher = await createWatcher(
      {
        ...inputOptions,
        logLevel: inputOptions.logLevel === 'silent' ? 'warn' : inputOptions.logLevel,
        onwarn: warning => {
          if (warning.code === 'CIRCULAR_DEPENDENCY') {
            if (warning.ids?.[0]?.includes('node_modules')) {
              return;
            }

            this.logger.warn('Circular dependency found', {
              dependency: warning.message.replace('Circular dependency: ', ''),
            });
          }
        },
        plugins: [
          ...(inputOptions.plugins as InputPluginOption[]),
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
              for (const instructionsPath of collectInstructionPaths(agents)) {
                this.addWatchFile(resolve(instructionsPath));
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
      const cb = (event: RollupWatcherEvent) => {
        if (event.code === 'BUNDLE_END') {
          devLogger.success('Initial bundle complete');
          watcher.off('event', cb);
          resolve(watcher);
        }

        if (event.code === 'ERROR') {
          console.info(event);
          devLogger.error('Bundling failed - check console for details');
          watcher.off('event', cb);
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
