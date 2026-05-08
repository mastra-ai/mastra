import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { shouldSkipDotenvLoading } from '../utils.js';

export class WorkerBundler extends Bundler {
  constructor({ outputDir }: { outputDir?: string } = {}) {
    super('Worker');
    this.platform = process.versions?.bun ? 'neutral' : 'node';
    if (outputDir) {
      this.outputDir = outputDir;
    }
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
