import path from 'path';
import { fileURLToPath } from 'url';
import type { ExtractorResult } from '@microsoft/api-extractor';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');

export async function bundleTypes(file: string) {
  // Configuration for bundling types
  const extractorConfig = ExtractorConfig.prepare({
    configObject: {
      // Main entry point for the type definitions
      mainEntryPointFilePath: path.join(packageDir, 'dist', file),

      // Bundle these external packages into the output
      bundledPackages: ['ai'],

      // Configure the .d.ts rollup
      dtsRollup: {
        enabled: true,
        publicTrimmedFilePath: path.join(packageDir, 'dist', file),
      },

      // Disable API report generation
      apiReport: {
        enabled: false,
      },

      // Disable doc model generation
      docModel: {
        enabled: false,
      },

      // Project folder
      projectFolder: packageDir,
      compiler: {
        tsconfigFilePath: path.join(packageDir, 'tsconfig.json'),
      },
    },
    packageJsonFullPath: path.join(packageDir, 'package.json'),
    configObjectFullPath: undefined,
  });

  // Run the extractor
  const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
    localBuild: true,
    showVerboseMessages: false,
  });

  if (extractorResult.succeeded) {
    return 0;
  } else {
    return 1;
  }
}
