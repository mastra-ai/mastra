import { removeAllOptionsExceptTelemetry } from './babel/remove-all-options-telemetry';
import type { Config } from '@mastra/core/mastra';
import { extractMastraOption, extractMastraOptionBundler } from './shared/extract-mastra-option';
import type { IMastraLogger } from '@mastra/core/logger';

export function getTelemetryBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return extractMastraOptionBundler('telemetry', entryFile, removeAllOptionsExceptTelemetry, result);
}

export async function writeTelemetryConfig(
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<{ externalDependencies: string[] } | null> {
  const result = await extractMastraOption<Config['telemetry']>(
    'telemetry',
    entryFile,
    removeAllOptionsExceptTelemetry,
    outputDir,
    logger,
  );

  if (!result) {
    return null;
  }

  const externals = result.bundleOutput.output[0].imports.filter(x => !x.startsWith('./'));

  return { externalDependencies: externals };
}
