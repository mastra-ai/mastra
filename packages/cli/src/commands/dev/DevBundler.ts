import { stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions, writeTelemetryConfig } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import { copy } from 'fs-extra';
import type { RollupWatcherEvent } from 'rollup';

export class DevBundler extends Bundler {
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

  async watch(entryFile: string, outputDirectory: string, toolsPaths: string[]): ReturnType<typeof createWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const envFiles = await this.getEnvFiles();
    const inputOptions = await getWatcherInputOptions(entryFile, 'node', {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    });
    const toolsInputOptions = await this.getToolsInputOptions(toolsPaths);

    await writeTelemetryConfig(entryFile, join(outputDirectory, this.outputDir));
    await this.writeInstrumentationFile(join(outputDirectory, this.outputDir));

    const outputDir = join(outputDirectory, this.outputDir);
    const copyPublic = this.copyPublic.bind(this);
    const copyPublicAssets = this.copyPublicAssets.bind(this);
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
            name: 'public-dir-watcher',
            buildStart() {
              this.addWatchFile(join(dirname(entryFile), 'public'));
            },
            buildEnd() {
              console.log('Copying public files');
              console.log(entryFile, outputDirectory);

              copyPublicAssets(dirname(entryFile), outputDirectory).catch(e => {
                console.error(`Failed to copy public assets: ${e}`);
              });

              return copyPublic(dirname(entryFile), outputDirectory);
            },
          },
          {
            name: 'tools-watcher',
            async buildEnd() {
              const toolsInputOptions = Array.from(Object.keys(inputOptions.input || {}))
                .filter(key => key.startsWith('tools/'))
                .map(key => `./${key}.mjs`);
              await writeFile(
                join(outputDir, 'tools.mjs'),
                `export const tools = ${JSON.stringify(toolsInputOptions)};`,
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

  /**
   * Copies the public directory from one level up from the entry file directory
   * @param entryFileDir The directory containing the entry file
   * @param outputDirectory The output directory
   */
  protected async copyPublicAssets(entryFileDir: string, outputDirectory: string) {
    // Go up two levels from the entry file directory
    // If entry file is in /path/to/project/src/index.js, we want to look in /path/to/project/public
    const projectRoot = dirname(dirname(entryFileDir));
    const publicDir = join(projectRoot, 'public');

    try {
      await stat(publicDir);
      this.logger.info(`Found public directory at ${publicDir}`);
    } catch {
      this.logger.info(`No public directory found at ${publicDir}`);
      return;
    }

    const outputPublicDir = join(outputDirectory, this.outputDir, 'public');
    this.logger.info(`Copying public directory to ${outputPublicDir}`);
    await copy(publicDir, outputPublicDir);
  }
}
