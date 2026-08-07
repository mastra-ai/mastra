import { isAbsolute, join, relative, resolve } from 'node:path';
import pkgJson from '../../../package.json';
import { FileService } from '../../services/service.file';
import { createLogger } from '../../utils/logger';
import { ExperimentBundler } from './ExperimentBundler';

export async function buildExperimentWorker({
  dir,
  root,
  outputDir,
  debug,
}: {
  dir?: string;
  root?: string;
  outputDir?: string;
  debug?: boolean;
}) {
  const rootDir = resolve(root || process.cwd());
  const mastraDir = dir ? (isAbsolute(dir) ? dir : join(rootDir, dir)) : join(rootDir, 'src', 'mastra');
  const outputDirectory = outputDir
    ? isAbsolute(outputDir)
      ? resolve(outputDir)
      : resolve(rootDir, outputDir)
    : join(rootDir, '.mastra', 'experiment-worker');
  const logger = createLogger(debug ?? false);

  try {
    const outputFromRoot = relative(resolve(rootDir), outputDirectory);
    const mastraFromOutput = relative(outputDirectory, resolve(mastraDir));
    if (
      outputFromRoot === '' ||
      mastraFromOutput === '' ||
      (!mastraFromOutput.startsWith('..') && !isAbsolute(mastraFromOutput))
    ) {
      throw new Error('Output directory must not be the project root or contain the Mastra source directory');
    }

    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);
    const bundler = new ExperimentBundler();
    bundler.__setLogger(logger);
    await bundler.prepare(outputDirectory);
    await bundler.bundle(mastraEntryFile, outputDirectory, { toolsPaths: [], projectRoot: rootDir });
    await bundler.writeArtifactManifest(outputDirectory, pkgJson.version);
    logger.info(`Experiment worker build complete: ${outputDirectory}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Experiment worker build failed: ${message}`, {
      ...(error instanceof Error ? { stack: error.stack } : {}),
    });
    process.exitCode = 1;
  }
}
