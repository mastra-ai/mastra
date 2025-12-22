import type { Config } from '@mastra/core/mastra';
import { extractMastraOption, extractMastraOptionBundler } from './shared/extract-mastra-option';
import type { IMastraLogger } from '@mastra/core/logger';

export function getDeployerBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return extractMastraOptionBundler('deployer', entryFile, result);
}

export async function getDeployer(
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<Config['deployer'] | null> {
  const result = await extractMastraOption('deployer', entryFile, outputDir, logger);
  if (!result) {
    return null;
  }

  return result.getConfig();
}
