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

/**
 * Validates the bundled output by attempting to import each generated module.
 * Tracks invalid chunks and external dependencies that couldn't be bundled.
 *
 * @param output - Bundle output from rollup
 * @param reverseVirtualReferenceMap - Map to resolve virtual module names back to original deps
 * @param outputDir - Directory containing the bundled files
 * @param logger - Logger instance for debugging
 * @param workspaceMap - Map of workspace packages that gets directly passed through for later consumption
 * @returns Analysis result containing invalid chunks and dependency mappings
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
    invalidChunks: new Set<string>(),
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
      result.invalidChunks.add(file.fileName);
      if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
        const reference = reverseVirtualReferenceMap.get(file.name)!;
        const dep = reference.startsWith('@') ? reference.split('/').slice(0, 2).join('/') : reference.split('/')[0];

        result.externalDependencies.add(dep!);
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
