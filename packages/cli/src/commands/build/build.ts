import { join } from 'node:path';

import { FileService } from '../../services/service.file';

import { BuildBundler } from './BuildBundler';
import { getDeployer } from '@mastra/deployer';
import { createLogger } from '../../utils/logger';

export async function build({
  dir,
  tools,
  root,
  debug,
}: {
  dir?: string;
  tools?: string[];
  root?: string;
  debug: boolean;
}) {
  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(rootDir, dir)) : join(rootDir, 'src', 'mastra');
  const outputDirectory = join(rootDir, '.mastra');
  const logger = createLogger(debug);

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const platformDeployer = await getDeployer(mastraEntryFile, outputDirectory);

    if (!platformDeployer) {
      const deployer = new BuildBundler();
      deployer.__setLogger(logger);

      // Use the bundler's getAllToolPaths method to prepare tools paths
      const discoveredTools = deployer.getAllToolPaths(mastraDir, tools);

      await deployer.prepare(outputDirectory);
      await deployer.bundle(mastraEntryFile, outputDirectory, {
        toolsPaths: discoveredTools,
        projectRoot: rootDir,
      });
      logger.info(`Build successful, you can now deploy the .mastra/output directory to your target platform.`);
      logger.info(`To start the server, run: node .mastra/output/index.mjs`);
      return;
    }

    logger.info('Deployer found, preparing deployer build...');

    platformDeployer.__setLogger(logger);

    const discoveredTools = platformDeployer.getAllToolPaths(mastraDir, tools ?? []);

    await platformDeployer.prepare(outputDirectory);
    await platformDeployer.bundle(mastraEntryFile, outputDirectory, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });
    logger.info('You can now deploy the .mastra/output directory to your target platform.');
  } catch (error) {
    try {
      const { MastraError } = await import('@mastra/core/error');
      if (error instanceof MastraError) {
        const { message, ...details } = error.toJSONDetails();
        logger.error(`${message}`, details);
      } else if (error instanceof Error) {
        logger.error(`Mastra Build failed`, { error });
      }
    } catch {
      if (error instanceof Error) {
        logger.error(`Mastra Build failed`, { error });
      }
    }
    process.exit(1);
  }
}
