import { isAbsolute, join, resolve } from 'node:path';
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

  // Two layouts.
  //
  // Default (no --output-dir):
  //   outputDirectory = <root>/.mastra
  //   outputDir       = 'output'
  //   → bundle at <root>/.mastra/output/index.mjs
  //   → analyze dir at <root>/.mastra/.build
  //   prepare() wipes <root>/.mastra (matches `mastra build`).
  //
  // Custom (--output-dir <path>):
  //   outputDirectory = <full resolved path>
  //   outputDir       = '.'
  //   → bundle at <path>/index.mjs
  //   → analyze dir at <path>/.build
  //   prepare() wipes <path> only — adjacent artifacts (including
  //   .mastra/output/) are left alone.
  let outputDirectory: string;
  let bundlerOutputDir: string;

  if (outputDir) {
    outputDirectory = isAbsolute(outputDir) ? resolve(outputDir) : resolve(rootDir, outputDir);
    bundlerOutputDir = '.';
  } else {
    outputDirectory = join(rootDir, '.mastra');
    bundlerOutputDir = 'output';
  }

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const bundler = new WorkerBundler({ outputDir: bundlerOutputDir });
    bundler.__setLogger(logger);

    const discoveredTools = bundler.getAllToolPaths(mastraDir, tools ? tools.split(',') : []);

    await bundler.prepare(outputDirectory);
    await bundler.bundle(mastraEntryFile, outputDirectory, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    const builtPath = join(outputDirectory, bundlerOutputDir, 'index.mjs');
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
