import { getDeployer } from '@mastra/deployer';
import { join } from 'path';

import { logger } from '../../utils/logger';

export async function deploy({ dir }: { dir?: string }) {
  let mastraDir = dir || join(process.cwd(), 'src/mastra');
  try {
    const outputDirectory = join(process.cwd(), '.mastra');
    const deployer = await getDeployer(mastraDir, outputDirectory);

    if (!deployer) {
      logger.warn('No deployer found.');
      return;
    }

    try {
      await deployer.prepare(outputDirectory);
      await deployer.bundle(mastraDir, outputDirectory);
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
