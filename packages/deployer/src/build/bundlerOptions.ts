import type { IMastraLogger } from '@internal/core/logger';
import type { BundlerConfig } from '@internal/deployer';
import { extractMastraOption, extractMastraOptionBundler } from './shared/extract-mastra-option';

export function getBundlerOptionsBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return extractMastraOptionBundler('bundler', entryFile, result);
}

export async function getBundlerOptions(
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<BundlerConfig | undefined | null> {
  const result = await extractMastraOption('bundler', entryFile, outputDir, logger);

  if (!result) {
    return null;
  }

  return result.getConfig();
}
