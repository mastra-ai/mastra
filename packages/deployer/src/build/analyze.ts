import type { IMastraLogger } from '@mastra/core/logger';
import * as babel from '@babel/core';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { OutputAsset, OutputChunk } from 'rollup';
import { join } from 'node:path';
import { validate } from '../validator/validate';
import { getBundlerOptions } from './bundlerOptions';
import { checkConfigExport } from './babel/check-config-export';
import { getWorkspaceInformation, type WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import type { DependencyMetadata } from './types';
import { analyzeEntry } from './analyze/analyzeEntry';
import { bundleExternals } from './analyze/bundleExternals';
import { getPackageInfo } from 'local-pkg';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { findNativePackageModule } from './utils';

type ErrorId = 'DEPLOYER_ANALYZE_MODULE_NOT_FOUND' | 'DEPLOYER_ANALYZE_MISSING_NATIVE_BUILD';

function throwExternalDependencyError({
  errorId,
  moduleName,
  packageName,
  messagePrefix,
}: {
  errorId: ErrorId;
  moduleName: string;
  packageName: string;
  messagePrefix: string;
}): never {
  throw new MastraError({
    id: errorId,
    domain: ErrorDomain.DEPLOYER,
    category: ErrorCategory.USER,
    details: {
      importFile: moduleName,
      packageName: packageName,
    },
    text: `${messagePrefix} \`${packageName}\` to your externals.

export const mastra = new Mastra({
  bundler: {
    externals: ["${packageName}"],
  }
})`,
  });
}

/**
 * Validates the bundled output by attempting to import each generated module.
 * Tracks external dependencies that couldn't be bundled.
 *
 * @param output - Bundle output from rollup
 * @param reverseVirtualReferenceMap - Map to resolve virtual module names back to original deps
 * @param outputDir - Directory containing the bundled files
 * @param logger - Logger instance for debugging
 * @param workspaceMap - Map of workspace packages that gets directly passed through for later consumption
 * @returns Analysis result containing dependency mappings
 */
async function validateOutput(
  {
    output,
    reverseVirtualReferenceMap,
    usedExternals,
    outputDir,
    projectRoot,
    workspaceMap,
  }: {
    output: (OutputChunk | OutputAsset)[];
    reverseVirtualReferenceMap: Map<string, string>;
    usedExternals: Record<string, Record<string, string>>;
    outputDir: string;
    projectRoot: string;
    workspaceMap: Map<string, WorkspacePackageInfo>;
  },
  logger: IMastraLogger,
) {
  const result = {
    dependencies: new Map<string, string>(),
    externalDependencies: new Set<string>(),
    workspaceMap,
  };

  // store resolve map for validation
  await writeFile(join(outputDir, 'module-resolve-map.json'), JSON.stringify(usedExternals, null, 2));

  // we should resolve the version of the deps
  for (const deps of Object.values(usedExternals)) {
    for (const dep of Object.keys(deps)) {
      result.externalDependencies.add(dep);
    }
  }

  for (const file of output) {
    if (file.type === 'asset') {
      continue;
    }

    try {
      logger.debug(`Validating if ${file.fileName} is a valid module.`);
      if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
        result.dependencies.set(reverseVirtualReferenceMap.get(file.name)!, file.fileName);
      }

      if (!file.isDynamicEntry && file.isEntry) {
        // validate if the chunk is actually valid, a failsafe to make sure bundling didn't make any mistakes
        await validate(join(projectRoot, file.fileName));
      }
    } catch (err) {
      if (err instanceof Error) {
        let moduleName: string | undefined | null = null;
        let errorConfig: {
          id: ErrorId;
          messagePrefix: string;
        } | null = null;

        if (err.message.includes('[ERR_MODULE_NOT_FOUND]')) {
          // This is the preferred way to get the module name that caused the issue
          const moduleIdName = file.moduleIds.length >= 2 ? file.moduleIds[file.moduleIds.length - 2] : undefined;
          // For some reason some virtual modules are quite sparse on their details, so name (e.g. '.mastra/.build/puppeteer') is a good enough fallback
          const fallbackName = file.name.split('/').pop();

          moduleName = moduleIdName ?? fallbackName;
          errorConfig = {
            id: 'DEPLOYER_ANALYZE_MODULE_NOT_FOUND',
            messagePrefix: "Mastra wasn't able to build your project. Please add",
          };
        } else if (err.message.includes('Error: No native build was found for ')) {
          moduleName = findNativePackageModule(file.moduleIds);
          errorConfig = {
            id: 'DEPLOYER_ANALYZE_MISSING_NATIVE_BUILD',
            messagePrefix: 'We found a binary dependency in your bundle. Please add',
          };
        }

        if (moduleName && errorConfig) {
          const pkgInfo = await getPackageInfo(moduleName);
          const packageName = pkgInfo?.packageJson?.name;

          if (packageName) {
            throwExternalDependencyError({
              errorId: errorConfig.id,
              moduleName,
              packageName,
              messagePrefix: errorConfig.messagePrefix,
            });
          } else {
            logger.debug(`Could not determine the module name for file ${file.fileName}`);
          }
        }

        logger.debug(`Error while validating module ${file.fileName}: ${err.message}`);
      }
    }
  }

  return result;
}

/**
 * Main bundle analysis function that orchestrates the three-step process:
 * 1. Analyze dependencies
 * 2. Bundle dependencies modules
 * 3. Validate generated bundles
 *
 * This helps identify which dependencies need to be externalized vs bundled.
 */
export async function analyzeBundle(
  entries: string[],
  mastraEntry: string,
  {
    outputDir,
    projectRoot,
    isDev = false,
    bundlerOptions: _bundlerOptions,
  }: {
    outputDir: string;
    projectRoot: string;
    platform: 'node' | 'browser';
    isDev?: boolean;
    bundlerOptions?: {
      enableEsmShim?: boolean;
    } | null;
  },
  logger: IMastraLogger,
) {
  const mastraConfig = await readFile(mastraEntry, 'utf-8');
  const mastraConfigResult = {
    hasValidConfig: false,
  } as const;

  await babel.transformAsync(mastraConfig, {
    filename: mastraEntry,
    presets: [import.meta.resolve('@babel/preset-typescript')],
    plugins: [checkConfigExport(mastraConfigResult)],
  });

  if (!mastraConfigResult.hasValidConfig) {
    logger.warn(`Invalid Mastra config. Please make sure that your entry file looks like this:
export const mastra = new Mastra({
  // your options
})
  
If you think your configuration is valid, please open an issue.`);
  }

  const { enableEsmShim = true } = _bundlerOptions || {};
  const bundlerOptions = await getBundlerOptions(mastraEntry, outputDir);
  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile: mastraEntry });

  let index = 0;
  const depsToOptimize = new Map<string, DependencyMetadata>();

  logger.info('Analyzing dependencies...');

  for (const entry of entries) {
    const isVirtualFile = entry.includes('\n') || !existsSync(entry);
    const analyzeResult = await analyzeEntry({ entry, isVirtualFile }, mastraEntry, {
      logger,
      sourcemapEnabled: bundlerOptions?.sourcemap ?? false,
      workspaceMap,
      projectRoot,
    });

    // Write the entry file to the output dir so that we can use it for workspace resolution stuff
    await writeFile(join(outputDir, `entry-${index++}.mjs`), analyzeResult.output.code);

    // Merge dependencies from each entry (main, tools, etc.)
    for (const [dep, metadata] of analyzeResult.dependencies.entries()) {
      if (depsToOptimize.has(dep)) {
        // Merge with existing exports if dependency already exists
        const existingEntry = depsToOptimize.get(dep)!;
        depsToOptimize.set(dep, {
          ...existingEntry,
          exports: [...new Set([...existingEntry.exports, ...metadata.exports])],
        });
      } else {
        depsToOptimize.set(dep, metadata);
      }
    }
  }

  /**
   * Only during `mastra dev` we want to optimize workspace packages. In previous steps we might have added dependencies that are not workspace packages, so we gotta remove them again.
   */
  if (isDev) {
    for (const [dep, metadata] of depsToOptimize.entries()) {
      if (!metadata.isWorkspace) {
        depsToOptimize.delete(dep);
      }
    }
  }

  logger.debug(`Analyzed dependencies: ${Array.from(depsToOptimize.keys()).join(', ')}`);

  logger.info('Optimizing dependencies...');
  logger.debug(
    `${Array.from(depsToOptimize.keys())
      .map(key => `- ${key}`)
      .join('\n')}`,
  );

  const { output, fileNameToDependencyMap, usedExternals } = await bundleExternals(depsToOptimize, outputDir, {
    bundlerOptions: {
      ...bundlerOptions,
      enableEsmShim,
      isDev,
    },
    projectRoot,
    workspaceRoot,
    workspaceMap,
  });

  const result = await validateOutput(
    {
      output,
      reverseVirtualReferenceMap: fileNameToDependencyMap,
      usedExternals,
      outputDir,
      projectRoot: workspaceRoot || projectRoot,
      workspaceMap,
    },
    logger,
  );

  return result;
}
