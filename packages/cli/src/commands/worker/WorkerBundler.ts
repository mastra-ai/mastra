import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { shouldSkipDotenvLoading } from '../utils.js';

export class WorkerBundler extends Bundler {
  private workerName: string;

  constructor(workerName: string = 'all') {
    super('Worker');
    this.workerName = workerName;
    this.platform = process.versions?.bun ? 'neutral' : 'node';
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
    const nameArg = this.workerName === 'all' ? 'undefined' : JSON.stringify(this.workerName);
    const startedLabel = this.workerName === 'all' ? 'Workers' : `Worker ${JSON.stringify(this.workerName)}`;
    return `
    import { mastra } from '#mastra';

    await mastra.startWorkers(${nameArg});

    console.log(${JSON.stringify(`[mastra] ${startedLabel} started`)});

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
