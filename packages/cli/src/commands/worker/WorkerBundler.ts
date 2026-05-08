import { join } from 'node:path';
import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { emptyDir, ensureDir } from 'fs-extra/esm';
import { shouldSkipDotenvLoading } from '../utils.js';

export class WorkerBundler extends Bundler {
  #scopedPrepare: boolean;

  constructor({ outputDir, scopedPrepare = false }: { outputDir?: string; scopedPrepare?: boolean } = {}) {
    super('Worker');
    this.platform = process.versions?.bun ? 'neutral' : 'node';
    if (outputDir) {
      this.outputDir = outputDir;
    }
    // When the caller is targeting a custom path that lives *next to* other
    // build artifacts (e.g. the server bundle), the default `prepare` behavior
    // — which empties the entire `outputDirectory` parent — would clobber
    // those siblings. With `scopedPrepare` we wipe only this bundler's own
    // leaf folder.
    this.#scopedPrepare = scopedPrepare;
  }

  async prepare(outputDirectory: string): Promise<void> {
    if (!this.#scopedPrepare) {
      return super.prepare(outputDirectory);
    }
    const bundleDir = join(outputDirectory, this.outputDir);
    const analyzeDir = join(outputDirectory, this.analyzeOutputDir);
    await emptyDir(bundleDir);
    await emptyDir(analyzeDir);
    await ensureDir(bundleDir);
    await ensureDir(analyzeDir);
  }

  getEnvFiles(): Promise<string[]> {
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

    const possibleFiles = ['.env.production', '.env.local', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);
      return Promise.resolve([envFile]);
    } catch {
      // ignore
    }

    return Promise.resolve([]);
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  protected getEntry(): string {
    return `
    import { mastra } from '#mastra';

    await mastra.startWorkers();

    console.log('[mastra] Workers started');

    const shutdown = async () => {
      console.log('[mastra] Shutting down workers...');
      await mastra.stopWorkers();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    `;
  }
}
