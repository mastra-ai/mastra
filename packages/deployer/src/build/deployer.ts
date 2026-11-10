import type { IMastraLogger } from '@internal/core/logger';
import type { IDeployer } from '@internal/deployer';
import { extractMastraOption, extractMastraOptionBundler } from './shared/extract-mastra-option';

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
): Promise<IDeployer | undefined | null> {
  const result = await extractMastraOption('deployer', entryFile, outputDir, logger);
  if (!result) {
    return null;
  }

  return result.getConfig();
}
