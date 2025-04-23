import { join } from 'path';
import { getDeployer } from '@mastra/deployer';

import { FileService } from '../../services/service.file';
import { logger } from '../../utils/logger';

export async function deploy({ dir }: { dir?: string }) {
  let mastraDir = dir || join(process.cwd(), 'src/mastra');
  try {
    const outputDirectory = join(process.cwd(), '.mastra');
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);
    const deployer = await getDeployer(mastraEntryFile, outputDirectory);

    if (!deployer) {
      logger.warn('No deployer found.');
      return;
    }

    try {
      await deployer.prepare(outputDirectory);
      await deployer.bundle(mastraEntryFile, outputDirectory, []);
      try {
        await deployer.deploy(outputDirectory);
      } catch (error) {
        console.error('[Mastra Deploy] - Error deploying:', error);
      }
    } catch (err) {
      if (err instanceof Error) {
        logger.debug(`error: ${err.message}`, { error: err });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.debug(`error: ${error.message}`, { error });
    }
    logger.warn('No deployer found.');
  }
}
