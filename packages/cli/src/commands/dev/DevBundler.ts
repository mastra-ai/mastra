import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions, writeTelemetryConfig } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import type { RollupWatcherEvent } from 'rollup';

export class DevBundler extends Bundler {
  private mastraToolsPaths: string[] = [];

  constructor() {
    super('Dev');
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.development', '.env.local', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch {
      // ignore
    }

    return Promise.resolve([]);
  }

  async loadEnvVars(): Promise<Map<string, string>> {
    const superEnvVars = await super.loadEnvVars();

    superEnvVars.set('MASTRA_TOOLS_PATH', this.mastraToolsPaths.join(','));

    return superEnvVars;
  }

  async writePackageJson() {}

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const playgroundServePath = join(outputDirectory, this.outputDir, 'playground');
    await fsExtra.copy(join(dirname(__dirname), 'src/playground/dist'), playgroundServePath, {
      overwrite: true,
    });
  }

  async watch(entryFile: string, outputDirectory: string, toolsPaths?: string[]): ReturnType<typeof createWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const envFiles = await this.getEnvFiles();
    const inputOptions = await getWatcherInputOptions(entryFile, 'node');

    await writeTelemetryConfig(entryFile, join(outputDirectory, this.outputDir));
    await this.writeInstrumentationFile(join(outputDirectory, this.outputDir));

    if (toolsPaths?.length) {
      for (const toolPath of toolsPaths) {
        if (await fsExtra.pathExists(toolPath)) {
          const toolName = basename(toolPath);
          const toolOutputPath = join(outputDirectory, this.outputDir, 'tools', toolName);

          const fileService = new FileService();
          const entryFile = fileService.getFirstExistingFile([
            join(toolPath, 'index.ts'),
            join(toolPath, 'index.js'),
            toolPath, // if toolPath itself is a file
          ]);

          if (!entryFile) {
            this.logger.warn(`No entry file found in ${toolPath}, skipping...`);
            continue;
          }

          const toolInputOptions = await getWatcherInputOptions(entryFile, 'node');
          const watcher = await createWatcher(
            {
              ...toolInputOptions,
              input: {
                index: entryFile,
              },
            },
            {
              dir: toolOutputPath,
            },
          );

          await new Promise((resolve, reject) => {
            const cb = (event: RollupWatcherEvent) => {
              if (event.code === 'BUNDLE_END') {
                watcher.off('event', cb);
                resolve(undefined);
              }
              if (event.code === 'ERROR') {
                watcher.off('event', cb);
                reject(event);
              }
            };
            watcher.on('event', cb);
          });

          this.mastraToolsPaths.push(join(toolOutputPath, 'index.mjs'));
        } else {
          this.logger.warn(`Tool path ${toolPath} does not exist, skipping...`);
        }
      }
    }

    const watcher = await createWatcher(
      {
        ...inputOptions,
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
            name: 'tools-watcher',
            buildStart() {
              if (toolsPaths?.length) {
                for (const toolPath of toolsPaths) {
                  this.addWatchFile(toolPath);
                }
              }
            },
          },
        ],
        input: {
          index: join(__dirname, 'templates', 'dev.entry.js'),
        },
      },
      {
        dir: join(outputDirectory, this.outputDir),
      },
    );

    this.logger.info('Starting watcher...');
    return new Promise((resolve, reject) => {
      const cb = (event: RollupWatcherEvent) => {
        if (event.code === 'BUNDLE_END') {
          this.logger.info('Bundling finished, starting server...');
          watcher.off('event', cb);
          resolve(watcher);
        }

        if (event.code === 'ERROR') {
          console.log(event);
          this.logger.error('Bundling failed, stopping watcher...');
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
