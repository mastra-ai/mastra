import type { IMastraLogger } from '@mastra/core/logger';
import * as babel from '@babel/core';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { OutputAsset, OutputChunk } from 'rollup';
import { basename, join, parse, relative } from 'node:path';
import { validate, ValidationError } from '../validator/validate';
import { getBundlerOptions } from './bundlerOptions';
import { checkConfigExport } from './babel/check-config-export';
import { getWorkspaceInformation, type WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import type { BundlerOptions, DependencyMetadata } from './types';
import { analyzeEntry } from './analyze/analyzeEntry';
import { bundleExternals } from './analyze/bundleExternals';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { getPackageName, isBuiltinModule, isDependencyPartOfPackage, type BundlerPlatform } from './utils';
import { GLOBAL_EXTERNALS } from './analyze/constants';
import * as stackTraceParser from 'stacktrace-parser';

type ErrorId =
  | 'DEPLOYER_ANALYZE_MODULE_NOT_FOUND'
  | 'DEPLOYER_ANALYZE_MISSING_NATIVE_BUILD'
  | 'DEPLOYER_ANALYZE_TYPE_ERROR';

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

function getPackageNameFromBundledModuleName(moduleName: string) {
  const chunks = moduleName.split('-');

  if (!chunks.length) {
    return moduleName;
  }

  if (chunks[0]?.startsWith('@')) {
    return chunks.slice(0, 2).join('/');
  }

  return chunks[0];
}

function validateError(
  err: ValidationError | Error,
  file: OutputChunk,
  {
    binaryMapData,
    workspaceMap,
  }: {
    binaryMapData: Record<string, string[]>;
    logger: IMastraLogger;
    workspaceMap: Map<string, WorkspacePackageInfo>;
  },
) {
  let moduleName: string | undefined | null = null;
  let errorConfig: {
    id: ErrorId;
    messagePrefix: string;
  } | null = null;

  if (err instanceof ValidationError) {
    const parsedStack = stackTraceParser.parse(err.stack);
    if (err.type === 'TypeError') {
      const pkgNameRegex = /.*node_modules\/([^\/]+)\//;
      const stacktraceFrame = parsedStack.find(frame => frame.file && pkgNameRegex.test(frame.file));
      if (stacktraceFrame) {
        const match = stacktraceFrame.file!.match(pkgNameRegex);
        moduleName = match?.[1] ?? getPackageNameFromBundledModuleName(basename(file.name));
      } else {
        moduleName = getPackageNameFromBundledModuleName(basename(file.name));
      }

      errorConfig = {
        id: 'DEPLOYER_ANALYZE_TYPE_ERROR',
        messagePrefix: `Mastra wasn't able to bundle "${moduleName}", might be an older commonJS module. Please add`,
      };
    } else if (err.stack?.includes?.('[ERR_MODULE_NOT_FOUND]')) {
      moduleName = err.message.match(/Cannot find package '([^']+)'/)?.[1];

      const parentModuleName = getPackageNameFromBundledModuleName(basename(file.name));

      errorConfig = {
        id: 'DEPLOYER_ANALYZE_MODULE_NOT_FOUND',
        messagePrefix: `Mastra wasn't able to build your project, We couldn't load "${moduleName}" from "${parentModuleName}". Make sure "${moduleName}" is installed or add`,
      };

      // if they are the same, the feedback we give to our user is not really useful and probably something else went wrong
      if (moduleName === parentModuleName) {
        return;
      }
    }
  }

  if (err.message.includes('No native build was found')) {
    const pkgName = getPackageNameFromBundledModuleName(basename(file.name));
    moduleName = binaryMapData[file.fileName]?.[0] ?? pkgName;
    errorConfig = {
      id: 'DEPLOYER_ANALYZE_MISSING_NATIVE_BUILD',
      messagePrefix: 'We found a binary dependency in your bundle but we cannot bundle it yet. Please add',
    };
  }

  if (moduleName && workspaceMap.has(moduleName)) {
    throw new MastraError({
      id: 'DEPLOYER_ANALYZE_ERROR_IN_WORKSPACE',
      domain: ErrorDomain.DEPLOYER,
      category: ErrorCategory.USER,
      details: {
        // importFile: moduleName,
        packageName: moduleName,
      },
      text: `We found an error in the ${moduleName} workspace package. Please find the offending package and fix the error.
  Error: ${err.stack}`,
    });
  }

  if (errorConfig && moduleName) {
    throwExternalDependencyError({
      errorId: errorConfig.id,
      moduleName: moduleName!,
      packageName: moduleName!,
      messagePrefix: errorConfig.messagePrefix,
    });
  }
}

async function validateFile(
  root: string,
  file: OutputChunk,
  {
    binaryMapData,
    moduleResolveMapLocation,
    logger,
    workspaceMap,
  }: {
    binaryMapData: Record<string, string[]>;
    moduleResolveMapLocation: string;
    logger: IMastraLogger;
    workspaceMap: Map<string, WorkspacePackageInfo>;
  },
) {
  try {
    if (!file.isDynamicEntry && file.isEntry) {
      // validate if the chunk is actually valid, a failsafe to make sure bundling didn't make any mistakes
      await validate(join(root, file.fileName), {
        moduleResolveMapLocation,
        injectESMShim: false,
      });
    }
  } catch (err) {
    let errorToHandle = err;
    if (
      err instanceof ValidationError &&
      err.type === 'ReferenceError' &&
      (err.message.startsWith('__dirname') || err.message.startsWith('__filename'))
    ) {
      try {
        await validate(join(root, file.fileName), {
          moduleResolveMapLocation,
          injectESMShim: true,
        });
        errorToHandle = null;
      } catch (err) {
        errorToHandle = err;
      }
    }

    if (errorToHandle instanceof Error) {
      validateError(errorToHandle, file, { binaryMapData, logger, workspaceMap });
    }
  }
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
  // we should resolve the version of the deps
  for (const deps of Object.values(usedExternals)) {
    for (const dep of Object.keys(deps)) {
      result.externalDependencies.add(dep);
    }
  }
  let binaryMapData: Record<string, string[]> = {};

  if (existsSync(join(outputDir, 'binary-map.json'))) {
    const binaryMap = await readFile(join(outputDir, 'binary-map.json'), 'utf-8');
    binaryMapData = JSON.parse(binaryMap);
  }

  for (const file of output) {
    if (file.type === 'asset') {
      continue;
    }

    logger.debug(`Validating if ${file.fileName} is a valid module.`);
    if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
      result.dependencies.set(reverseVirtualReferenceMap.get(file.name)!, file.fileName);
    }

    // validate if the chunk is actually valid, a failsafe to make sure bundling didn't make any mistakes
    await validateFile(projectRoot, file, {
      binaryMapData,
      moduleResolveMapLocation: join(outputDir, 'module-resolve-map.json'),
      logger,
      workspaceMap,
    });
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
    bundlerOptions,
  }: {
    outputDir: string;
    projectRoot: string;
    platform: BundlerPlatform;
    isDev?: boolean;
    bundlerOptions?: Pick<BundlerOptions, 'externals' | 'enableSourcemap'> | null;
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

  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile: mastraEntry });

  let externalsPreset = false;

  const userExternals = Array.isArray(bundlerOptions?.externals) ? bundlerOptions?.externals : [];
  if (bundlerOptions?.externals === true) {
    externalsPreset = true;
  }

  let index = 0;
  const depsToOptimize = new Map<string, DependencyMetadata>();
  const allExternals: string[] = [...GLOBAL_EXTERNALS, ...userExternals].filter(Boolean) as string[];

  logger.info('Analyzing dependencies...');

  const allUsedExternals = new Set<string>();
  for (const entry of entries) {
    const isVirtualFile = entry.includes('\n') || !existsSync(entry);
    const analyzeResult = await analyzeEntry({ entry, isVirtualFile }, mastraEntry, {
      logger,
      sourcemapEnabled: bundlerOptions?.enableSourcemap ?? false,
      workspaceMap,
      projectRoot,
      shouldCheckTransitiveDependencies: isDev || externalsPreset,
    });

    // Write the entry file to the output dir so that we can use it for workspace resolution stuff
    await writeFile(join(outputDir, `entry-${index++}.mjs`), analyzeResult.output.code);

    // Merge dependencies from each entry (main, tools, etc.)
    for (const [dep, metadata] of analyzeResult.dependencies.entries()) {
      const isPartOfExternals = allExternals.some(external => isDependencyPartOfPackage(dep, external));
      if (isPartOfExternals || (externalsPreset && !metadata.isWorkspace)) {
        // Add all packages coming from src/mastra
        allUsedExternals.add(dep);
        continue;
      }

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
  if (isDev || externalsPreset) {
    for (const [dep, metadata] of depsToOptimize.entries()) {
      if (!metadata.isWorkspace) {
        depsToOptimize.delete(dep);
      }
    }
  }

  const sortedDeps = Array.from(depsToOptimize.keys()).sort();
  logger.info('Optimizing dependencies...');
  logger.debug(`${sortedDeps.map(key => `- ${key}`).join('\n')}`);

  const { output, fileNameToDependencyMap, usedExternals } = await bundleExternals(depsToOptimize, outputDir, {
    bundlerOptions: {
      ...bundlerOptions,
      externals: bundlerOptions?.externals ?? allExternals,
      isDev,
    },
    projectRoot,
    workspaceRoot,
    workspaceMap,
  });

  const relativeWorkspaceFolderPaths = Array.from(workspaceMap.values()).map(pkgInfo =>
    relative(workspaceRoot || projectRoot, pkgInfo.location),
  );

  for (const o of output) {
    if (o.type === 'asset') {
      continue;
    }

    for (const i of o.imports) {
      if (isBuiltinModule(i)) {
        continue;
      }

      // Skip relative imports - they're local chunks, not external packages
      if (i.startsWith('.') || i.startsWith('/')) {
        continue;
      }

      // Do not include workspace packages
      if (relativeWorkspaceFolderPaths.some(workspacePath => i.startsWith(workspacePath))) {
        continue;
      }

      const pkgName = getPackageName(i);

      if (pkgName) {
        allUsedExternals.add(pkgName);
      }
    }
  }

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

  /**
   * Include user-specified externals in the result even if they weren't detected during static analysis.
   * This is important for packages that are dynamically imported at runtime (e.g., pino.transport({ target: "package-name" }))
   * which cannot be detected by static analysis but need to be in the output package.json.
   * See: https://github.com/mastra-ai/mastra/issues/10893
   */
  return {
    ...result,
    externalDependencies: new Set([
      ...result.externalDependencies,
      ...Array.from(allUsedExternals),
      ...userExternals.filter((ext): ext is string => typeof ext === 'string'),
    ]),
  };
}
