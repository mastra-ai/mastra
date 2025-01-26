import * as prompts from '@clack/prompts';
import { Deployer } from '@mastra/deployer';
import { join } from 'path';

import { logger } from '../../utils/logger.js';

export async function deploy({ dir, token }: { dir?: string; token?: string }) {
  let tokenToUse;

  if (!token) {
    const v = await prompts.text({
      message: 'Provide an access token',
    });

    if (!v) {
      logger.debug('No token provided, exiting...');
      return;
    }
    tokenToUse = v as string;
  } else {
    tokenToUse = token;
  }

  if (!tokenToUse || tokenToUse === 'clack:cancel') {
    logger.debug('No token provided, exiting...');
    return;
  }

  let directoryToDeploy = dir || join(process.cwd(), 'src/mastra');

  const deployer = new Deployer({
    dir: process.cwd(),
    type: 'Deploy',
  });

  await deployer.prepare({
    dir: directoryToDeploy,
  });

  const { mastra } = await deployer.getMastra();

  const resDeployer = mastra.getDeployer();

  if (!resDeployer) {
    // If no deployer, we are deploying to Mastra Cloud
  } else {
    resDeployer.writeFiles({ dir: deployer.getMastraPath() });

    try {
      await resDeployer.deploy({
        dir: deployer.getMastraPath(),
        token: tokenToUse,
      });
    } catch (error) {
      console.error('[Mastra Deploy] - Error deploying:', error);
    }
  }
}
