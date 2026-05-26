import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import type { InputPluginOption, RollupWatcherEvent } from 'rollup';

import { devLogger } from '../../utils/dev-logger.js';
import { shouldSkipDotenvLoading } from '../utils.js';

function isSourceModeEnabled() {
  return process.env.MASTRA_SOURCE_MODE === '1';
}

export class DevBundler extends Bundler {
  private customEnvFile?: string;

  constructor(customEnvFile?: string) {
    super('Dev');
    this.customEnvFile = customEnvFile;
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

  private async getSourceModeStudioPath(packagedStudioPath: string): Promise<string | null> {
    try {
      const playgroundPackageJsonPath = fileURLToPath(import.meta.resolve('@internal/playground/package.json'));
      const playgroundRoot = dirname(playgroundPackageJsonPath);
      const playgroundDist = join(playgroundRoot, 'dist');

      if (await fsExtra.pathExists(join(playgroundDist, 'index.html'))) {
        return playgroundDist;
      }
    } catch {
      // ignore and fall back to packaged assets below
    }

    if (await fsExtra.pathExists(join(packagedStudioPath, 'index.html'))) {
      return packagedStudioPath;
    }

    return null;
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const studioServePath = join(outputDirectory, this.outputDir, 'studio');
    const packagedStudioPath = join(dirname(__dirname), 'dist', 'studio');
    const studioSourcePath = isSourceModeEnabled()
      ? await this.getSourceModeStudioPath(packagedStudioPath)
      : packagedStudioPath;

    if (studioSourcePath) {
      await fsExtra.copy(studioSourcePath, studioServePath, {
        overwrite: true,
      });
      return;
    }

    await mkdir(studioServePath, { recursive: true });
    await writeFile(
      join(studioServePath, 'index.html'),
      '<!doctype html><html><head><title>Mastra</title></head><body><main>Mastra dev server running in source mode. Studio assets are unavailable because packages/playground/dist has not been built.</main></body></html>',
    );
  }

  async watch(
    entryFile: string,
    outputDirectory: string,
    toolsPaths: (string | string[])[],
  ): ReturnType<typeof createWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageRoot = __dirname.endsWith(`${sep}dist`) ? dirname(__dirname) : dirname(dirname(dirname(__dirname)));

    const envFiles = await this.getEnvFiles();
    const bundlerOptions = await this.getUserBundlerOptions(entryFile, outputDirectory);
    const sourcemapEnabled = !!bundlerOptions?.sourcemap;
    const sourceModeTemplatePath = join(packageRoot, 'src', 'public', 'templates', 'dev.entry.js');
    const templatePath =
      isSourceModeEnabled() && (await fsExtra.pathExists(sourceModeTemplatePath))
        ? sourceModeTemplatePath
        : join(__dirname, 'templates', 'dev.entry.js');

    const inputOptions = await getWatcherInputOptions(
      entryFile,
      this.platform,
      {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      { sourcemap: sourcemapEnabled },
    );
    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths);

    const outputDir = join(outputDirectory, this.outputDir);

    await this.writePackageJson(outputDir, new Map(), {});

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
                this.addWatchFile(envFile);
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
          index: templatePath,
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
