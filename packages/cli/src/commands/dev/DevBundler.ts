import { MastraBundler } from '@mastra/core/bundler';
import { FileService, getWatcher } from '@mastra/deployer';
import virtual from '@rollup/plugin-virtual';
import * as fsExtra from 'fs-extra';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RollupWatcherEvent } from 'rollup';

export class DevBundler extends MastraBundler {
  constructor() {
    super({
      name: 'Dev',
      component: 'BUNDLER',
    });
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
    const watcher = await getWatcher({
      ...this.getInputOptions(),
      // @ts-ignore
      output: {
        dir: outputDirectory,
        format: 'es',
        entryFileNames: '[name].mjs',
      },
      watch: {
        include: await this.getEnvFiles(),
      },
    });

    this.logger.info('Starting watcher...');
    return new Promise((resolve, reject) => {
      const cb = (event: RollupWatcherEvent) => {
        if (event.code === 'BUNDLE_END') {
          this.logger.info('Bundling finished, starting server...');
          watcher.off('event', cb);
          resolve(watcher);
        }

        if (event.code === 'ERROR') {
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

  private getEntry(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return readFileSync(join(__dirname, 'templates', 'dev.entry.js'), 'utf8');
  }

  private getInputOptions() {
    return {
      input: {
        index: '#entry',
      },
      plugins: [virtual({ '#entry': this.getEntry() })],
    };
  }
}
