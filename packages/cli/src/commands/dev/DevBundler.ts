import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions, writeTelemetryConfig, getBundlerOptions } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import type { RollupWatcherEvent } from 'rollup';

import { devLogger } from '../../utils/dev-logger.js';

export class DevBundler extends Bundler {
  private customEnvFile?: string;

  constructor(customEnvFile?: string) {
    super('Dev');
    this.customEnvFile = customEnvFile;
  }

  getEnvFiles(): Promise<string[]> {
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
    await super.prepare(outputDirectory);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const playgroundServePath = join(outputDirectory, this.outputDir, 'playground');
    await fsExtra.copy(join(dirname(__dirname), 'dist/playground'), playgroundServePath, {
      overwrite: true,
    });
  }

  async watch(
    entryFile: string,
    outputDirectory: string,
    toolsPaths: (string | string[])[],
  ): ReturnType<typeof createWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const envFiles = await this.getEnvFiles();

    let sourcemapEnabled = false;
    try {
      const bundlerOptions = await getBundlerOptions(entryFile, outputDirectory);
      sourcemapEnabled = !!bundlerOptions?.sourcemap;
    } catch (error) {
      this.logger.debug('Failed to get bundler options, sourcemap will be disabled', { error });
    }

    const inputOptions = await getWatcherInputOptions(
      entryFile,
      'node',
      {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      { sourcemap: sourcemapEnabled },
    );
    const toolsInputOptions = await this.getToolsInputOptions(toolsPaths);

    const outputDir = join(outputDirectory, this.outputDir);
    await writeTelemetryConfig(entryFile, outputDir, this.logger);

    const mastraFolder = dirname(entryFile);
    const fileService = new FileService();
    const customInstrumentation = fileService.getFirstExistingFileOrUndefined([
      join(mastraFolder, 'instrumentation.js'),
      join(mastraFolder, 'instrumentation.ts'),
      join(mastraFolder, 'instrumentation.mjs'),
    ]);

    await this.writeInstrumentationFile(outputDir, customInstrumentation);

    await this.writePackageJson(outputDir, new Map(), {});

    const copyPublic = this.copyPublic.bind(this);

    const watcher = await createWatcher(
      {
        ...inputOptions,
        logLevel: inputOptions.logLevel === 'silent' ? 'warn' : inputOptions.logLevel,
        onwarn: warning => {
          if (warning.code === 'CIRCULAR_DEPENDENCY') {
            if (warning.ids?.[0]?.includes('node_modules')) {
              return;
            }

            this.logger.warn(`Circular dependency found:
\t${warning.message.replace('Circular dependency: ', '')}`);
          }
        },
        plugins: [
          // @ts-ignore - types are good
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          ...inputOptions.plugins,
          {
            name: 'env-watcher',
            buildStart() {
              for (const envFile of envFiles) {
                this.addWatchFile(envFile);
              }
            },
          },
          {
            name: 'public-dir-watcher',
            buildStart() {
              this.addWatchFile(join(dirname(entryFile), 'public'));
            },
            buildEnd() {
              return copyPublic(dirname(entryFile), outputDirectory);
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
          index: join(__dirname, 'templates', 'dev.entry.js'),
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
