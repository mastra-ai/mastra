import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { basename, isAbsolute, join, relative } from 'node:path';
import { transformSync } from '@babel/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@internal/core/error';
import type { IMastraLogger } from '@internal/core/logger';
import type { OutputAsset, OutputChunk } from 'rolldown';
import * as stackTraceParser from 'stacktrace-parser';
import { getWorkspaceInformation } from '../bundler/workspaceDependencies';
import type { WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import { validate, ValidationError } from '../validator/validate';
import { analyzeEntry, createEntryScanner, prefetchEntry } from './analyze/analyzeEntry';
import type { EntryScanOptions } from './analyze/analyzeEntry';
import { bundleExternals } from './analyze/bundleExternals';
import { DEPS_TO_IGNORE } from './analyze/constants';
import { normalizeExternals } from './analyze/externals';
import { checkMastraConfigExport } from './analyzeEntryProjectType';
import { detectPinoTransports } from './babel/detect-pino-transports';
import { createPackageLookupCache, getPackageMetadata } from './package-info';
import type { PackageLookupCache } from './package-info';
import type { DependencyMetadata, ExternalDependencyInfo, InternalBundlerOptions } from './types';
import {
  getPackageName,
  isBareModuleSpecifier,
  isBuiltinModule,
  isDependencyPartOfPackage,
  isExternalProtocolImport,
  slash,
} from './utils';
import type { BundlerPlatform } from './utils';

type ErrorId =
  | 'DEPLOYER_ANALYZE_MODULE_NOT_FOUND'
  | 'DEPLOYER_ANALYZE_MISSING_NATIVE_BUILD'
  | 'DEPLOYER_ANALYZE_TYPE_ERROR';

function preferDependencyInfo(
  existing: ExternalDependencyInfo | undefined,
  incoming: ExternalDependencyInfo,
): ExternalDependencyInfo {
  return {
    version: incoming.version ?? existing?.version,
    packageSpec: incoming.packageSpec ?? existing?.packageSpec,
  };
}

async function resolveDependencyInfo(
  dep: string,
  existing: ExternalDependencyInfo | undefined,
  parentPaths: string[],
  packageLookupCache: PackageLookupCache,
): Promise<ExternalDependencyInfo> {
  if (existing?.version || existing?.packageSpec) {
    return existing;
  }

  const packageName = getPackageName(dep);
  const packageNames = [...new Set([dep, packageName].filter(Boolean) as string[])];

  for (const parentPath of parentPaths) {
    for (const name of packageNames) {
      const metadata = await getPackageMetadata(name, parentPath, packageLookupCache);
      if (metadata.version || metadata.packageSpec) {
        return preferDependencyInfo(existing, metadata);
      }
    }
  }

  for (const name of packageNames) {
    const metadata = await getPackageMetadata(name, undefined, packageLookupCache);
    if (metadata.version || metadata.packageSpec) {
      return preferDependencyInfo(existing, metadata);
    }
  }

  return existing ?? {};
}

function importerParentPaths(importerId: string | undefined, base: string[]): string[] {
  if (!importerId || importerId.startsWith('\x00') || !isAbsolute(importerId)) {
    return base;
  }

  return [...new Set([importerId, ...base])];
}

function getLastConcreteModuleId(moduleIds: string[]): string | undefined {
  return moduleIds.findLast(id => !id.startsWith('\x00') && isAbsolute(id));
}

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
  // New encoding uses __ to separate path segments (e.g., @inner__inner-tools -> @inner/inner-tools)
  if (moduleName.includes('__')) {
    return moduleName.replaceAll('__', '/');
  }

  // Legacy fallback for old format using - as separator
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
    stubbedExternals,
  }: {
    binaryMapData: Record<string, string[]>;
    moduleResolveMapLocation: string;
    logger: IMastraLogger;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    stubbedExternals: string[];
  },
) {
  try {
    if (!file.isDynamicEntry && file.isEntry) {
      // validate if the chunk is actually valid, a failsafe to make sure bundling didn't make any mistakes
      await validate(join(root, file.fileName), {
        moduleResolveMapLocation,
        injectESMShim: false,
        stubbedExternals,
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
          stubbedExternals,
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

// Each validation spawns a Node process; leave a core for the main process.
const VALIDATION_CONCURRENCY = Math.max(1, Math.min(4, availableParallelism() - 1));

/**
 * Runs `task` for each item with at most `concurrency` tasks in flight. When tasks fail, rejects with the error of the
 * first failing item in input order, the same error a sequential loop would throw. Items after a known failure are not
 * started.
 */
async function forEachWithFirstErrorInOrder<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  let failedIndex = Infinity;
  let failure: unknown;

  async function worker() {
    // Items start in input order, so once item `failedIndex` failed, every earlier item has already started.
    while (nextIndex < items.length && nextIndex < failedIndex) {
      const index = nextIndex++;
      try {
        await task(items[index]!);
      } catch (error) {
        if (index < failedIndex) {
          failedIndex = index;
          failure = error;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));

  if (failedIndex !== Infinity) {
    throw failure;
  }
}

/**
 * Validates the bundled output by attempting to import each generated module.
 * Tracks external dependencies that couldn't be bundled.
 *
 * The imports run in child processes and only decide whether the build may succeed: nothing they find feeds the
 * returned dependency data. So the checks are returned as a pending `validation` the caller awaits when it has to.
 *
 * @param output - Bundle output from rollup
 * @param reverseVirtualReferenceMap - Map to resolve virtual module names back to original deps
 * @param outputDir - Directory containing the bundled files
 * @param logger - Logger instance for debugging
 * @param workspaceMap - Map of workspace packages that gets directly passed through for later consumption
 * @returns Analysis result containing dependency mappings, and the running validation
 */
async function validateOutput(
  {
    output,
    reverseVirtualReferenceMap,
    usedExternals,
    mergedExternals,
    outputDir,
    projectRoot,
    workspaceMap,
    depsVersionInfo,
    packageLookupCache,
  }: {
    output: (OutputChunk | OutputAsset)[];
    reverseVirtualReferenceMap: Map<string, string>;
    usedExternals: Record<string, Record<string, string>>;
    mergedExternals: string[];
    outputDir: string;
    projectRoot: string;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    depsVersionInfo: Map<string, ExternalDependencyInfo>;
    packageLookupCache: PackageLookupCache;
  },
  logger: IMastraLogger,
) {
  const result = {
    dependencies: new Map<string, string>(),
    externalDependencies: new Map<string, ExternalDependencyInfo>(),
    workspaceMap,
  };

  const externalMetadataParentPaths = [
    projectRoot,
    ...Array.from(workspaceMap.values()).map(pkgInfo => pkgInfo.location),
  ];

  // store resolve map for validation
  // we should resolve the version of the deps
  for (const deps of Object.values(usedExternals)) {
    for (const [dep, importerId] of Object.entries(deps)) {
      if (isExternalProtocolImport(dep)) {
        continue;
      }

      const pkgName = getPackageName(dep);
      if (pkgName) {
        // Use version info from analysis if available, then resolve from the module that imported the external.
        const versionInfo = depsVersionInfo.get(dep) || depsVersionInfo.get(pkgName);
        const dependencyInfo = await resolveDependencyInfo(
          dep,
          versionInfo,
          importerParentPaths(importerId, externalMetadataParentPaths),
          packageLookupCache,
        );
        result.externalDependencies.set(
          pkgName,
          preferDependencyInfo(result.externalDependencies.get(pkgName), dependencyInfo),
        );
      }
    }
  }
  let binaryMapData: Record<string, string[]> = {};

  if (existsSync(join(outputDir, 'binary-map.json'))) {
    const binaryMap = await readFile(join(outputDir, 'binary-map.json'), 'utf-8');
    binaryMapData = JSON.parse(binaryMap);
  }

  const stubbedExternals = [...new Set([...mergedExternals, ...DEPS_TO_IGNORE, ...result.externalDependencies.keys()])];

  const chunks = output.filter((file): file is OutputChunk => file.type === 'chunk');
  for (const file of chunks) {
    if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
      result.dependencies.set(reverseVirtualReferenceMap.get(file.name)!, file.fileName);
    }
  }

  // validate if the chunks are actually valid, a failsafe to make sure bundling didn't make any mistakes
  const validation = forEachWithFirstErrorInOrder(chunks, VALIDATION_CONCURRENCY, async file => {
    logger.debug('Validating module', { fileName: file.fileName });
    await validateFile(projectRoot, file, {
      binaryMapData,
      moduleResolveMapLocation: join(outputDir, 'module-resolve-map.json'),
      logger,
      workspaceMap,
      stubbedExternals,
    });
  });
  // Handled by whoever awaits it; this keeps a failure from being reported as unhandled in the meantime.
  validation.catch(() => {});

  return { result, validation };
}

type AnalyzeBundleOptions = {
  outputDir: string;
  projectRoot: string;
  platform: BundlerPlatform;
  isDev?: boolean;
  bundlerOptions?: Pick<
    InternalBundlerOptions,
    'externals' | 'externalsPreset' | 'enableSourcemap' | 'dynamicPackages' | 'alias'
  > | null;
  env?: Record<string, string>;
};

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
  options: AnalyzeBundleOptions,
  logger: IMastraLogger,
) {
  const { validation, ...analysis } = await analyzeBundleDeferringValidation(entries, mastraEntry, options, logger);
  await validation;
  return analysis;
}

/**
 * {@link analyzeBundle} without waiting for step 3. The returned analysis is complete; `validation` settles once every
 * validation process has exited and rejects with the error `analyzeBundle` would throw. Callers can do more work in
 * the meantime but must await `validation` before treating the build as successful.
 */
export async function analyzeBundleDeferringValidation(
  entries: string[],
  mastraEntry: string,
  {
    outputDir,
    projectRoot,
    platform,
    isDev = false,
    bundlerOptions,
    env = { 'process.env.NODE_ENV': JSON.stringify('production') },
  }: AnalyzeBundleOptions,
  logger: IMastraLogger,
) {
  const mastraConfigResult = await checkMastraConfigExport(mastraEntry);

  if (!mastraConfigResult.hasValidConfig) {
    logger.warn('Invalid Mastra config', {
      details:
        'Please make sure that your entry file looks like this:\nexport const mastra = new Mastra({\n  // your options\n})\n\nIf you think your configuration is valid, please open an issue.',
    });
  }

  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile: mastraEntry });

  const { externalsPreset, mergedExternals } = normalizeExternals(
    bundlerOptions?.externals,
    bundlerOptions?.externalsPreset,
  );
  const userDynamicPackages = bundlerOptions?.dynamicPackages ?? [];

  let index = 0;
  const depsToOptimize = new Map<string, DependencyMetadata>();

  // Collect pino transports detected across all entries
  const detectedPinoTransports = new Set<string>();

  logger.info('Analyzing dependencies...');

  // Track external dependencies with their version info
  const allUsedExternals = new Map<string, ExternalDependencyInfo>();
  // Shared cache prevents re-analyzing the same workspace package across entries and recursive calls.
  const analyzeCache = new Map<string, Awaited<ReturnType<typeof analyzeEntry>>>();
  const activeAnalyzeEntries = new Set<string>();
  // Scoped to this call so a long-running `mastra dev` sees installs that changed since the last analysis.
  const packageLookupCache = createPackageLookupCache();
  const entryScanner = createEntryScanner();
  const entryScanOptions: EntryScanOptions = {
    sourcemapEnabled: bundlerOptions?.enableSourcemap ?? false,
    env,
    alias: bundlerOptions?.alias ?? {},
    platform,
    workspaceMap,
    projectRoot,
    packageLookupCache,
  };
  const entryConfigs = entries.map(entry => ({ entry, isVirtualFile: entry.includes('\n') || !existsSync(entry) }));

  // The Rolldown passes of all entries run ahead in parallel; their results are merged one entry at a time, in
  // input order, so the output doesn't depend on which pass finishes first.
  for (const entryConfig of entryConfigs) {
    prefetchEntry(entryConfig, mastraEntry, entryScanOptions, entryScanner);
  }

  try {
    for (const entryConfig of entryConfigs) {
      const analyzeResult = await analyzeEntry(entryConfig, mastraEntry, {
        ...entryScanOptions,
        logger,
        shouldCheckTransitiveDependencies: true,
        analyzeCache,
        activeEntries: activeAnalyzeEntries,
        scanner: entryScanner,
        externals: mergedExternals,
        externalsPreset,
      });

      // Detect pino transports in the bundled output. Skips the Babel parse when nothing can match.
      // A false match parses the whole chunk (~750ms on a real app), so require a quoted `pino` or a `pino.transport`.
      const code = analyzeResult.output.code;
      if (
        code.includes('pino') &&
        /\.transport\s*\(/.test(code) &&
        (/(['"`])pino\1/.test(code) || /\bpino\s*\.\s*(?:default\s*\.\s*)?transport\b/.test(code))
      ) {
        transformSync(analyzeResult.output.code, {
          filename: 'pino-detection.js',
          plugins: [() => detectPinoTransports(detectedPinoTransports)],
          configFile: false,
          babelrc: false,
          code: false,
        });
      }

      // Write the entry file to the output dir so that we can use it for workspace resolution stuff
      await writeFile(join(outputDir, `entry-${index++}.mjs`), analyzeResult.output.code);

      // Merge dependencies from each entry (main, tools, etc.)
      for (const [dep, metadata] of analyzeResult.dependencies.entries()) {
        const isPartOfExternals = mergedExternals.some(external => isDependencyPartOfPackage(dep, external));
        if (isPartOfExternals || (externalsPreset && !metadata.isWorkspace)) {
          // Add all packages coming from src/mastra with their version info
          const pkgName = getPackageName(dep);
          if (pkgName) {
            allUsedExternals.set(pkgName, preferDependencyInfo(allUsedExternals.get(pkgName), metadata));
          }
          continue;
        }

        if (depsToOptimize.has(dep)) {
          // Merge with existing exports if dependency already exists
          const existingEntry = depsToOptimize.get(dep)!;
          depsToOptimize.set(dep, {
            ...existingEntry,
            version: metadata.version ?? existingEntry.version,
            packageSpec: metadata.packageSpec ?? existingEntry.packageSpec,
            exports: [...new Set([...existingEntry.exports, ...metadata.exports])],
          });
        } else {
          depsToOptimize.set(dep, metadata);
        }
      }
    }
  } catch (error) {
    await entryScanner.close();
    throw error;
  }

  // Build a map of dependency versions from the full analysis result before dev/externalsPreset pruning.
  // Non-workspace deps are removed from optimization below, but their resolved version/packageSpec metadata
  // is still needed when they become externals.
  const depsVersionInfo = new Map<string, ExternalDependencyInfo>();
  for (const [dep, metadata] of depsToOptimize.entries()) {
    const pkgName = getPackageName(dep);
    if (pkgName && (metadata.version || metadata.packageSpec)) {
      depsVersionInfo.set(pkgName, preferDependencyInfo(depsVersionInfo.get(pkgName), metadata));
    }
    // Also store by full import path for subpath imports
    if (metadata.version || metadata.packageSpec) {
      depsVersionInfo.set(dep, preferDependencyInfo(depsVersionInfo.get(dep), metadata));
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
  logger.debug('Sorted dependencies', { deps: sortedDeps });

  const { output, fileNameToDependencyMap, usedExternals, requiredExternals } = await bundleExternals(
    depsToOptimize,
    outputDir,
    {
      bundlerOptions: {
        externalsPreset,
        mergedExternals,
        isDev,
        alias: bundlerOptions?.alias,
      },
      projectRoot,
      workspaceRoot,
      workspaceMap,
      platform,
    },
  );

  // Filesystem-relative workspace paths for filtering workspace imports from bundler output.
  // Normalize to forward slashes so the startsWith check works on Windows where
  // path.relative() produces backslashes but the bundler uses forward slashes.
  const relativeWorkspaceFolderPaths = Array.from(workspaceMap.values()).map(pkgInfo =>
    slash(relative(workspaceRoot || projectRoot, pkgInfo.location)),
  );

  const externalImports: Array<{ imports: Iterable<string>; importerId: string | undefined }> = output
    .filter(o => o.type === 'chunk')
    .map(o => ({ imports: o.imports, importerId: getLastConcreteModuleId(o.moduleIds) }));
  // `require()`d externals stay lazy `createRequire` calls and are missing from `chunk.imports`.
  externalImports.push({ imports: requiredExternals, importerId: undefined });

  for (const { imports, importerId } of externalImports) {
    for (const i of imports) {
      if (isBuiltinModule(i)) {
        continue;
      }

      // Skip relative imports - they're local chunks, not external packages
      if (i.startsWith('.') || i.startsWith('/')) {
        continue;
      }

      if (!isBareModuleSpecifier(i) || isExternalProtocolImport(i)) {
        continue;
      }

      // Do not include workspace packages
      if (relativeWorkspaceFolderPaths.some(workspacePath => i.startsWith(workspacePath))) {
        continue;
      }

      const pkgName = getPackageName(i);

      if (pkgName && workspaceMap.has(pkgName)) {
        continue;
      }

      if (pkgName) {
        // Try to get version info from our tracked dependencies, then resolve from the chunk's source module.
        const versionInfo = depsVersionInfo.get(i) || depsVersionInfo.get(pkgName);
        const dependencyInfo = await resolveDependencyInfo(
          i,
          versionInfo,
          importerParentPaths(importerId, [
            projectRoot,
            ...Array.from(workspaceMap.values()).map(pkgInfo => pkgInfo.location),
          ]),
          packageLookupCache,
        );
        allUsedExternals.set(pkgName, preferDependencyInfo(allUsedExternals.get(pkgName), dependencyInfo));
      }
    }
  }

  const { result, validation } = await validateOutput(
    {
      output,
      reverseVirtualReferenceMap: fileNameToDependencyMap,
      usedExternals,
      mergedExternals,
      outputDir,
      projectRoot: workspaceRoot || projectRoot,
      workspaceMap,
      depsVersionInfo,
      packageLookupCache,
    },
    logger,
  );

  // The lookups below overlap with the validation processes.
  try {
    /**
     * Build the final set of external dependencies from four sources:
     * 1. result.externalDependencies - externals discovered during bundle validation
     * 2. allUsedExternals - packages detected via static analysis that matched the externals config
     * 3. detectedPinoTransports - pino transports detected by the plugin during bundling
     * 4. userDynamicPackages - user-specified packages loaded dynamically at runtime
     *
     * Prefer entries with version info over entries without
     */
    const mergedExternalDeps = new Map<string, ExternalDependencyInfo>(result.externalDependencies);
    for (const [dep, info] of allUsedExternals) {
      if (isExternalProtocolImport(dep)) {
        continue;
      }

      mergedExternalDeps.set(dep, preferDependencyInfo(mergedExternalDeps.get(dep), info));
    }

    const externalMetadataParentPaths = [
      projectRoot,
      ...Array.from(workspaceMap.values()).map(pkgInfo => pkgInfo.location),
      // Last resort: resolve from the deployer's own installed location. Some externals are
      // discovered inside externalized packages (e.g. optional dynamic imports like
      // `import('typescript')` in @mastra/core) without being installed in the user's project.
      import.meta.dirname,
    ];

    // Retry externals that were discovered without install metadata (e.g. from entry analysis
    // where the package isn't resolvable from the entry's own location).
    for (const [dep, info] of mergedExternalDeps) {
      if (!info.version && !info.packageSpec) {
        mergedExternalDeps.set(
          dep,
          await resolveDependencyInfo(dep, info, externalMetadataParentPaths, packageLookupCache),
        );
      }
    }

    // Add pino transports and user dynamic packages
    for (const transport of detectedPinoTransports) {
      if (!mergedExternalDeps.has(transport)) {
        mergedExternalDeps.set(
          transport,
          await resolveDependencyInfo(transport, undefined, externalMetadataParentPaths, packageLookupCache),
        );
      }
    }
    for (const pkg of userDynamicPackages) {
      if (!mergedExternalDeps.has(pkg)) {
        mergedExternalDeps.set(
          pkg,
          await resolveDependencyInfo(pkg, undefined, externalMetadataParentPaths, packageLookupCache),
        );
      }
    }

    return {
      ...result,
      externalDependencies: mergedExternalDeps,
      /**
       * Workspace deps that were optimized (after isDev/externalsPreset pruning).
       * Used by the watcher to re-run optimization when workspace sources change.
       */
      depsToOptimize,
      workspaceRoot,
      outputDir,
      ...(mastraConfigResult.projectType ? { projectType: mastraConfigResult.projectType } : {}),
      validation,
    };
  } catch (error) {
    // Validation ran before these lookups when it was awaited in place, so its failure still wins.
    await validation;
    throw error;
  }
}
