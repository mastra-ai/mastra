import { removeAllOptionsExceptServer } from './babel/remove-all-options-server';
import type { Config } from '@mastra/core/mastra';
import { extractMastraOption, extractMastraOptionBundler } from './shared/extract-mastra-option';
import type { IMastraLogger } from '@mastra/core/logger';

export function getServerOptionsBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return extractMastraOptionBundler('server', entryFile, removeAllOptionsExceptServer, result);
}

export async function getServerOptions(
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<Config['server'] | null> {
  const result = await extractMastraOption<Config['server']>(
    'server',
    entryFile,
    removeAllOptionsExceptServer,
    outputDir,
    logger,
  );
  if (!result) {
    return null;
  }

  return result.getConfig();
}
