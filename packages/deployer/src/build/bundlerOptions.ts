import type { Config } from '@mastra/core/mastra';
import { extractMastraOption, extractMastraOptionBundler } from './shared/extract-mastra-option';
import type { IMastraLogger } from '@mastra/core/logger';

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
): Promise<Config['bundler'] | null> {
  const result = await extractMastraOption('bundler', entryFile, outputDir, logger);

  if (!result) {
    return null;
  }

  return result.getConfig();
}
