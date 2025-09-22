import { removeAllOptionsExceptBundler } from './babel/remove-all-options-bundler';
import type { Config } from '@mastra/core/mastra';
import { extractMastraOption, extractMastraOptionBundler } from './shared/extract-mastra-option';
import type { IMastraLogger } from '@mastra/core/logger';
import type { BundlerOptions } from './types';

const DEFAULT_OPTIONS: BundlerOptions = {
  externals: [],
  sourcemap: false,
  transpilePackages: [],
};

export function getBundlerOptionsBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return extractMastraOptionBundler('bundler', entryFile, removeAllOptionsExceptBundler, result);
}

export async function getBundlerOptions(
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<BundlerOptions> {
  try {
    const result = await extractMastraOption<Config['bundler']>(
      'bundler',
      entryFile,
      removeAllOptionsExceptBundler,
      outputDir,
      logger,
    );

    if (!result) {
      return DEFAULT_OPTIONS;
    }

    return { ...DEFAULT_OPTIONS, ...(await result.getConfig()) };
  } catch {
    return DEFAULT_OPTIONS;
  }
}
