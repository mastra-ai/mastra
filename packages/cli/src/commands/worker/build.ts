import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { FileService } from '../../services/service.file';
import { createLogger } from '../../utils/logger';
import { WorkerBundler } from './WorkerBundler';

export async function buildWorker({
  dir,
  root,
  tools,
  outputDir,
  debug,
}: {
  dir?: string;
  root?: string;
  tools?: string;
  outputDir?: string;
  debug?: boolean;
}) {
  const rootDir = root || process.cwd();
  const mastraDir: string = dir ? (isAbsolute(dir) ? dir : join(rootDir, dir)) : join(rootDir, 'src', 'mastra');
  const logger = createLogger(debug ?? false);

  // Default target: `.mastra/output/index.mjs` (matches `mastra build`'s
  // server bundle path; running both back-to-back will overwrite). Caller can
  // pass `--output-dir <path>` to redirect the worker bundle anywhere — at
  // which point we scope `prepare` to that leaf so adjacent artifacts are not
  // wiped.
  let bundleParent: string;
  let bundleLeaf: string;
  let scopedPrepare: boolean;

  if (outputDir) {
    const fullPath = isAbsolute(outputDir) ? resolve(outputDir) : resolve(rootDir, outputDir);
    bundleParent = dirname(fullPath);
    bundleLeaf = basename(fullPath);
    scopedPrepare = true;
  } else {
    bundleParent = join(rootDir, '.mastra');
    bundleLeaf = 'output';
    scopedPrepare = false;
  }

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const bundler = new WorkerBundler({ outputDir: bundleLeaf, scopedPrepare });
    bundler.__setLogger(logger);

    const discoveredTools = bundler.getAllToolPaths(mastraDir, tools ? tools.split(',') : []);

    await bundler.prepare(bundleParent);
    await bundler.bundle(mastraEntryFile, bundleParent, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    const builtPath = join(bundleParent, bundleLeaf, 'index.mjs');
    logger.info('Worker build complete.');
    logger.info(`Run with: mastra worker start [name]${outputDir ? ` --dir ${outputDir}` : ''}`);
    logger.info(`  or:     node ${builtPath}`);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Worker build failed: ${error.message}`, { stack: error.stack });
    }
    process.exit(1);
  }
}
