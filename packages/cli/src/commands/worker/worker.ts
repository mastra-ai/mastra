import { isAbsolute, join } from 'node:path';
import { FileService } from '../../services/service.file';
import { createLogger } from '../../utils/logger';
import { WorkerBundler } from './WorkerBundler';

export async function startWorker({
  name,
  dir,
  root,
  tools,
  debug,
}: {
  name?: string;
  dir?: string;
  root?: string;
  tools?: string;
  debug: boolean;
}) {
  const workerName = name || 'all';
  const rootDir = root || process.cwd();
  const mastraDir: string = dir ? (isAbsolute(dir) ? dir : join(rootDir, dir)) : join(rootDir, 'src', 'mastra');
  const outputDirectory = join(rootDir, '.mastra');
  const logger = createLogger(debug);

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const bundler = new WorkerBundler(workerName);
    bundler.__setLogger(logger);

    const discoveredTools = bundler.getAllToolPaths(mastraDir, tools ? tools.split(',') : []);

    await bundler.prepare(outputDirectory);
    await bundler.bundle(mastraEntryFile, outputDirectory, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    logger.info(`Worker build complete. Starting worker "${workerName}"...`);
    logger.info('Run: node .mastra/output/index.mjs');

    // Execute the built worker
    const { spawn } = await import('node:child_process');
    const outputFile = join(outputDirectory, 'output', 'index.mjs');

    const child = spawn(process.execPath, [outputFile], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', err => {
      logger.error(`Worker process failed to start: ${err instanceof Error ? err.message : String(err)}`, {
        stack: err instanceof Error ? err.stack : undefined,
      });
      process.exit(1);
    });

    child.on('exit', code => {
      process.exit(code ?? 0);
    });

    // Forward signals to child
    const forwardSignal = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };
    process.on('SIGINT', () => forwardSignal('SIGINT'));
    process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Worker start failed: ${error.message}`, { stack: error.stack });
    }
    process.exit(1);
  }
}
