import * as prompts from '@clack/prompts';
// import { readFileSync } from 'fs';
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
      logger.log('No token provided, exiting...');
      return;
    }
    tokenToUse = v as string;
  } else {
    tokenToUse = token;
  }

  if (!tokenToUse || tokenToUse === 'clack:cancel') {
    logger.log('No token provided, exiting...');
    return;
  }

  let directoryToDeploy = dir || join(process.cwd(), 'src/mastra');

  const deployer = new Deployer({
    dir: process.cwd(),
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

// function removeCloudflareDeployer(code: string) {
//   // Array of patterns to match CloudflareDeployer related code
//   const patterns = [
//     // Remove CloudflareDeployer import
//     /import\s*{\s*CloudflareDeployer\s*}\s*from\s*["']@mastra\/deployer-cloudflare["'];\s*\n?/g,

//     // Remove deployer instantiation block
//     /var\s+deployer\s*=\s*new\s+CloudflareDeployer\s*\({[\s\S]*?\}\);\s*\n?/g,

//     // Remove deployer from exports
//     /,?\s*deployer(?=\s*[,}])/g
//   ];

//   // Apply each pattern to remove CloudflareDeployer code
//   let cleanedCode = code;
//   patterns.forEach(pattern => {
//     cleanedCode = cleanedCode.replace(pattern, '');
//   });

//   // Clean up any multiple empty lines that might be left
//   cleanedCode = cleanedCode.replace(/(\r?\n){3,}/g, '\n\n');

//   return cleanedCode;
// }
