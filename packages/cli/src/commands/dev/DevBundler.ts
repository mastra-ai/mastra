import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions, writeTelemetryConfig } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
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
    const inputOptions = await getWatcherInputOptions(entryFile, 'node');
    const toolsInputOptions = await this.getToolsInputOptions(toolsPaths);

    await writeTelemetryConfig(entryFile, join(outputDirectory, this.outputDir));
    await this.writeInstrumentationFile(join(outputDirectory, this.outputDir));

    const outputDir = join(outputDirectory, this.outputDir);
    const copyPublic = this.copyPublic.bind(this);
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
}
