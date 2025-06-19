import { join } from 'node:path';

import { FileService } from '../../services/service.file';

import { BuildBundler } from './BuildBundler';
import { getDeployer } from '@mastra/deployer';
import { logger } from '../../utils/logger';

export async function build({
  dir,
  tools,
  root,
  env,
}: {
  dir?: string;
  tools?: string[];
  root?: string;
  env?: string;
}) {
  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(rootDir, dir)) : join(rootDir, 'src', 'mastra');
  const outputDirectory = join(rootDir, '.mastra');

  const defaultToolsPath = join(mastraDir, 'tools/**/*.{js,ts}');
  const discoveredTools = [defaultToolsPath, ...(tools ?? [])];

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const platformDeployer = await getDeployer(mastraEntryFile, outputDirectory);
    if (!platformDeployer) {
      const deployer = new BuildBundler(env);
      deployer.__setLogger(logger);
      await deployer.prepare(outputDirectory);
      await deployer.bundle(mastraEntryFile, outputDirectory, discoveredTools);
      logger.info(`Build successful, you can now deploy the .mastra/output directory to your target platform.`);
      logger.info(
        `To start the server, run: node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs`,
      );
      return;
    }

    logger.info('Deployer found, preparing deployer build...');

    platformDeployer.__setLogger(logger);
    await platformDeployer.prepare(outputDirectory);
    await platformDeployer.bundle(mastraEntryFile, outputDirectory, discoveredTools);
    logger.info('You can now deploy the .mastra/output directory to your target platform.');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Mastra Build failed`, { error });
    }
    process.exit(1);
  }
}
