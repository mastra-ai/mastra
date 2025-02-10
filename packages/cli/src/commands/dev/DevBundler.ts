import { MastraBundler } from '@mastra/core/bundler';
import { FileService, getWatcher } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions } from '@mastra/deployer/build';
import * as fsExtra from 'fs-extra';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RollupWatcherEvent } from 'rollup';

export class DevBundler extends MastraBundler {
  private mastraDir: string;
  constructor(mastraDir: string) {
    super({
      name: 'Dev',
      component: 'BUNDLER',
    });

    this.mastraDir = mastraDir;
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.development', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch (err) {}

    return Promise.resolve([]);
  }

  async writePackageJson() {}

  async prepare(outputDirectory: string): Promise<void> {
    await fsExtra.ensureDir(outputDirectory);

    // Clean up the output directory first
    await fsExtra.emptyDir(outputDirectory);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const playgroundServePath = join(outputDirectory, 'playground');
    await fsExtra.copy(join(dirname(__dirname), 'src/playground/dist'), playgroundServePath, {
      overwrite: true,
    });
  }

  async watch(outputDirectory: string): ReturnType<typeof getWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const fileService = new FileService();
    const entryFile = fileService.getFirstExistingFile([
      join(this.mastraDir, 'index.ts'),
      join(this.mastraDir, 'index.js'),
    ]);

    const envFiles = await this.getEnvFiles();
    const inputOptions = await getWatcherInputOptions(entryFile, 'node');

    const watcher = await createWatcher(
      {
        ...inputOptions,
        plugins: [
          // @ts-ignore - types are good
          ...inputOptions.plugins,
          {
            name: 'env-watcher',
            buildStart() {
              for (const envFile of envFiles) {
                this.addWatchFile(envFile);
              }
            },
          },
        ],
        input: {
          index: join(__dirname, 'templates', 'dev.entry.js'),
        },
      },
      {
        dir: outputDirectory,
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
