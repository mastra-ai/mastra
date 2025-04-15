import { join } from 'node:path';

import { FileService } from '../../services/service.file';

import { BuildBundler } from './BuildBundler';
import { getDeployer } from '@mastra/deployer';
import { logger } from '../../utils/logger';

export async function build({
  dir,
  excludePlayground,
  excludeSwaggerUI,
  excludeOpenAPI,
}: {
  dir?: string;
  excludePlayground?: boolean;
  excludeSwaggerUI?: boolean;
  excludeOpenAPI?: boolean;
}) {
  const mastraDir = dir ?? join(process.cwd(), 'src', 'mastra');
  const outputDirectory = join(process.cwd(), '.mastra');

  try {
    const fs = new FileService();
    const mastraEntryFile = fs.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const platformDeployer = await getDeployer(mastraEntryFile, outputDirectory);

    if (!platformDeployer) {
      const deployer = new BuildBundler();
      await deployer.prepare(outputDirectory);

      await deployer.bundle(mastraEntryFile, outputDirectory, {
        playground: excludePlayground ? false : true,
        swaggerUI: excludeSwaggerUI ? false : true,
        openAPI: excludeOpenAPI ? false : true,
      });
      return;
    }

    logger.info('Deployer found, preparing deployer build...');

    await platformDeployer.prepare(outputDirectory);
    await platformDeployer.bundle(mastraEntryFile, outputDirectory);
    logger.info('You can now deploy the .mastra/output directory to your target platform.');
  } catch (error) {
    if (error instanceof Error) {
      logger.debug(`error: ${error.message}`, { error });
    }
  }
}
