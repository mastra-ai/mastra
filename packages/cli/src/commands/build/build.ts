import { join } from 'node:path';

import { FileService } from '../../services/service.file';

import { BuildBundler } from './BuildBundler';
import { getDeployer } from '@mastra/deployer';
import { logger } from '../../utils/logger';

export async function build({ dir, tools }: { dir?: string; tools?: string[] }) {
  const mastraDir = dir ?? join(process.cwd(), 'src', 'mastra');
  const outputDirectory = join(process.cwd(), '.mastra');

  const defaultToolsPath = join(mastraDir, 'tools');
  const discoveredTools = [defaultToolsPath, ...(tools ?? [])];

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const platformDeployer = await getDeployer(mastraEntryFile, outputDirectory);

    if (!platformDeployer) {
      const deployer = new BuildBundler();
      await deployer.prepare(outputDirectory);
      await deployer.bundle(mastraEntryFile, outputDirectory, discoveredTools);
      return;
    }

    logger.info('Deployer found, preparing deployer build...');

    await platformDeployer.prepare(outputDirectory);
    await platformDeployer.bundle(mastraEntryFile, outputDirectory, discoveredTools);
    logger.info('You can now deploy the .mastra/output directory to your target platform.');
  } catch (error) {
    if (error instanceof Error) {
      logger.debug(`error: ${error.message}`, { error });
    }
  }
}
