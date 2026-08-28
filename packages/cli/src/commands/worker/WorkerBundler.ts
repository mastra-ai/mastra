import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { shouldSkipDotenvLoading } from '../utils.js';

export function getWorkerEntry(): string {
  return `
    import { createServer } from 'node:http';
    import { mastra } from '#mastra';

    let workersReady = false;
    let shuttingDown = false;

    const healthServer = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');

      if (request.url !== '/health') {
        response.statusCode = 404;
        response.end(JSON.stringify({ status: 'not_found' }));
        return;
      }

      response.statusCode = workersReady ? 200 : 503;
      response.end(JSON.stringify({ status: workersReady ? 'ready' : 'starting' }));
    });

    const port = Number.parseInt(process.env.PORT ?? '4111', 10);
    await new Promise((resolve, reject) => {
      const onError = error => reject(error);
      healthServer.once('error', onError);
      healthServer.listen(port, '0.0.0.0', () => {
        healthServer.off('error', onError);
        resolve();
      });
    });

    try {
      await mastra.startWorkers();
      workersReady = true;
      console.log('[mastra] Workers started');
    } catch (error) {
      healthServer.close();
      throw error;
    }

    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      workersReady = false;
      console.log('[mastra] Shutting down workers...');
      healthServer.close();
      await mastra.stopWorkers();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    `;
}

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

    return Promise.resolve(new FileService().getExistingFiles(['.env', '.env.local', '.env.production']));
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  protected getEntry(): string {
    return getWorkerEntry();
  }
}
