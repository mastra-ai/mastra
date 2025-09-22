import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '@mastra/core/mastra';
import { FileService } from '@mastra/deployer';
import {
  createWatcher,
  getWatcherInputOptions,
  writeTelemetryConfig,
  getBundlerOptions,
  generateEntry,
} from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import type { RollupWatcherEvent } from 'rollup';

import { devLogger } from '../../utils/dev-logger.js';

export class DevBundler extends Bundler {
  private customEnvFile?: string;
  private rootDir: string;

  constructor(rootDir: string, customEnvFile?: string) {
    super('Dev');
    this.customEnvFile = customEnvFile;
    this.rootDir = rootDir;
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

    const toolsInputOptions = await this.getToolsInputOptions(toolsPaths);
    await generateEntry(entryFile, toolsInputOptions, join(outputDirectory, this.analyzeOutputDir));
    const compiledEntryFile = join(outputDirectory, this.analyzeOutputDir, 'entry.js');
    const bundlerOptions = await getBundlerOptions(compiledEntryFile, outputDirectory);

    const inputOptions = await getWatcherInputOptions(compiledEntryFile, {
      env: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      bundlerOptions,
      tools: toolsInputOptions,
      projectRoot: this.rootDir,
    });

    const outputDir = join(outputDirectory, this.outputDir);
    await writeTelemetryConfig(compiledEntryFile, outputDir, this.logger);

    const mastraFolder = dirname(entryFile);
    const fileService = new FileService();
    const customInstrumentation = fileService.getFirstExistingFileOrUndefined(
      ['ts', 'mjs', 'js'].map(ext => join(mastraFolder, `instrumentation.${ext}`)),
    );

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
          // {
          //   name: 'tools-watcher',
          //   async buildEnd() {
          //     const toolImports: string[] = [];
          //     const toolsExports: string[] = [];
          //     Array.from(Object.keys(toolsInputOptions || {}))
          //       .filter(key => key.startsWith('tools/'))
          //       .forEach((key, index) => {
          //         const toolExport = `tool${index}`;
          //         toolImports.push(`import * as ${toolExport} from './${key}.mjs';`);
          //         toolsExports.push(toolExport);
          //       });

          //     await writeFile(
          //       join(outputDir, 'tools.mjs'),
          //       `${toolImports.join('\n')}

          //       export const tools = [${toolsExports.join(', ')}]`,
          //     );
          //   },
          // },
        ],
        input: {
          index: join(__dirname, 'templates', 'dev.entry.js'),
          tools: './tools.mjs',
        },
      },
      {
        dir: outputDir,
        sourcemap: bundlerOptions.sourcemap,
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
