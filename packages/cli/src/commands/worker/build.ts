import { isAbsolute, join } from 'node:path';
import { FileService } from '../../services/service.file';
import { createLogger } from '../../utils/logger';
import { WorkerBundler } from './WorkerBundler';

export async function buildWorker({
  dir,
  root,
  tools,
  debug,
}: {
  dir?: string;
  root?: string;
  tools?: string;
  debug?: boolean;
}) {
  const rootDir = root || process.cwd();
  const mastraDir: string = dir ? (isAbsolute(dir) ? dir : join(rootDir, dir)) : join(rootDir, 'src', 'mastra');
  const outputDirectory = join(rootDir, '.mastra');
  const logger = createLogger(debug ?? false);

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const bundler = new WorkerBundler();
    bundler.__setLogger(logger);

    const discoveredTools = bundler.getAllToolPaths(mastraDir, tools ? tools.split(',') : []);

    await bundler.prepare(outputDirectory);
    await bundler.bundle(mastraEntryFile, outputDirectory, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    logger.info('Worker build complete.');
    logger.info('Run with: mastra worker start [name]');
    logger.info('  or:     node .mastra/output/worker.mjs');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Worker build failed: ${error.message}`, { stack: error.stack });
    }
    process.exit(1);
  }
}
