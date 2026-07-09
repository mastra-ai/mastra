import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative } from 'node:path';
import { transformAsync, transformSync } from '@babel/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import type { OutputAsset, OutputChunk } from 'rollup';
import * as stackTraceParser from 'stacktrace-parser';
import { getWorkspaceInformation } from '../bundler/workspaceDependencies';
import type { WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import { validate, ValidationError } from '../validator/validate';
import { analyzeEntry } from './analyze/analyzeEntry';
import { bundleExternals } from './analyze/bundleExternals';
import { DEPRECATED_EXTERNALS, DEPS_TO_IGNORE, GLOBAL_EXTERNALS } from './analyze/constants';
import { normalizeExternals } from './analyze/externals';
import { checkConfigExport } from './babel/check-config-export';
import { detectPinoTransports } from './babel/detect-pino-transports';
import { getPackageMetadata } from './package-info';
import type { BundlerOptions, DependencyMetadata, ExternalDependencyInfo } from './types';
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
): Promise<ExternalDependencyInfo> {
  if (existing?.version || existing?.packageSpec) {
    return existing;
  }

  const packageName = getPackageName(dep);
  const packageNames = [...new Set([dep, packageName].filter(Boolean) as string[])];

  for (const parentPath of parentPaths) {
    for (const name of packageNames) {
      const metadata = await getPackageMetadata(name, parentPath);
      if (metadata.version || metadata.packageSpec) {
        return preferDependencyInfo(existing, metadata);
      }
    }
  }

  for (const name of packageNames) {
    const metadata = await getPackageMetadata(name);
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

/**
 * Collects the package names a stack trace points at, closest to the throw site first.
 *
 * Every `node_modules` segment of a path counts, not just the last one, because a nested install
 * layout puts a package's ancestors in its own path: a throw inside
 * `node_modules/jsonwebtoken/node_modules/jws/node_modules/jwa/index.js` should be blamed on
 * `jwa` first, then `jws`, then `jsonwebtoken` — the user may have externalized any of them.
 * Handles scoped packages and skips pnpm's `.pnpm` store segment.
 */
function getPackageNamesFromStack(stack: string): string[] {
  const packageNames: string[] = [];

  for (const line of stack.split('\n')) {
    const segments = [...line.matchAll(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/g)].map(match =>
      match[1]!.replaceAll('\\', '/'),
    );

    // Deepest segment first: the package the file belongs to, then the packages it is nested under.
    for (const packageName of segments.reverse()) {
      if (packageName !== '.pnpm' && !packageNames.includes(packageName)) {
        packageNames.push(packageName);
      }
    }
  }

  return packageNames;
}

/**
 * Finds the externalized package a validation failure should be blamed on, if any.
 *
 * Externalized packages are installed at runtime rather than bundled, so a failure that comes
 * from one is not evidence of a bundling problem — it is a package the validation pass should
 * not have needed to execute at all. Two shapes are recognised:
 *
 * - the package could not be loaded at all (`ERR_MODULE_NOT_FOUND`), named in the message
 * - the package threw while evaluating, in which case its files appear in the stack
 */
function findExternalizedPackageInError(
  err: Error,
  {
    externalizablePackages,
    externalsPreset,
    workspaceMap,
  }: {
    externalizablePackages: string[];
    externalsPreset: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
  },
): string | undefined {
  if (!externalsPreset && externalizablePackages.length === 0) {
    return undefined;
  }

  const missingPackage = err.stack?.includes('[ERR_MODULE_NOT_FOUND]')
    ? err.message.match(/Cannot find package '([^']+)'/)?.[1]
    : undefined;

  const candidates = [...(missingPackage ? [getPackageName(missingPackage) ?? missingPackage] : [])];
  if (err.stack) {
    candidates.push(...getPackageNamesFromStack(err.stack));
  }

  for (const packageName of candidates) {
    // Workspace packages are always bundled, never externalized — errors in them are real.
    if (workspaceMap.has(packageName)) {
      continue;
    }

    // `externals: true` externalizes every non-workspace dependency.
    if (externalsPreset || externalizablePackages.some(external => isDependencyPartOfPackage(packageName, external))) {
      return packageName;
    }
  }

  return undefined;
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
    externalizablePackages,
    externalsPreset,
  }: {
    binaryMapData: Record<string, string[]>;
    moduleResolveMapLocation: string;
    logger: IMastraLogger;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    stubbedExternals: string[];
    externalizablePackages: string[];
    externalsPreset: boolean;
  },
) {
  let injectESMShim = false;

  try {
    if (!file.isDynamicEntry && file.isEntry) {
      // validate if the chunk is actually valid, a failsafe to make sure bundling didn't make any mistakes
      await validate(join(root, file.fileName), {
        moduleResolveMapLocation,
        injectESMShim,
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
      injectESMShim = true;
      try {
        await validate(join(root, file.fileName), {
          moduleResolveMapLocation,
          injectESMShim,
          stubbedExternals,
        });
        errorToHandle = null;
      } catch (err) {
        errorToHandle = err;
      }
    }

    if (errorToHandle instanceof Error) {
      // An externalized package is installed at runtime, not bundled, so it does not have to
      // survive being executed here. Retry with that one package stubbed out. Stubbing on demand
      // rather than up front keeps externalized packages that bundled code legitimately uses at
      // module-evaluation time working. See issues #18626 and #16626.
      const externalizedPackage = findExternalizedPackageInError(errorToHandle, {
        externalizablePackages,
        externalsPreset,
        workspaceMap,
      });

      if (externalizedPackage) {
        logger.debug('Retrying validation with externalized package stubbed', {
          fileName: file.fileName,
          packageName: externalizedPackage,
        });

        errorToHandle = null;

        try {
          await validate(join(root, file.fileName), {
            moduleResolveMapLocation,
            injectESMShim,
            stubbedExternals: [...stubbedExternals, externalizedPackage],
          });
        } catch {
          // The stub is a bare `export default {}`, so it cannot stand in for every import shape
          // — a named import of it fails to link, for instance. That tells us nothing about the
          // bundle: this chunk can only be executed with the real package, which is precisely the
          // package we have decided not to execute. Validation is inconclusive here rather than
          // failed, so warn and keep going instead of ending the build.
          logger.warn(
            `Skipped validating "${file.fileName}": it cannot be executed without "${externalizedPackage}", which is externalized. If the built output misbehaves, check that "${externalizedPackage}" is installed where you deploy it.`,
          );
        }
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
    mergedExternals,
    externalsPreset,
    outputDir,
    projectRoot,
    workspaceMap,
    depsVersionInfo,
  }: {
    output: (OutputChunk | OutputAsset)[];
    reverseVirtualReferenceMap: Map<string, string>;
    usedExternals: Record<string, Record<string, string>>;
    mergedExternals: string[];
    externalsPreset: boolean;
    outputDir: string;
    projectRoot: string;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    depsVersionInfo: Map<string, ExternalDependencyInfo>;
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

  // GLOBAL_EXTERNALS, DEPRECATED_EXTERNALS and DEPS_TO_IGNORE are small, curated lists the
  // maintainers control, so stubbing them up front is safe. Packages the *user* externalized are
  // ordinary runtime libraries — bundled code may legitimately use them while it evaluates — so
  // those are stubbed only in response to an actual failure, inside validateFile.
  const stubbedExternals = [...new Set([...GLOBAL_EXTERNALS, ...DEPRECATED_EXTERNALS, ...DEPS_TO_IGNORE])];

  for (const file of output) {
    if (file.type === 'asset') {
      continue;
    }

    logger.debug('Validating module', { fileName: file.fileName });
    if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
      result.dependencies.set(reverseVirtualReferenceMap.get(file.name)!, file.fileName);
    }

    // validate if the chunk is actually valid, a failsafe to make sure bundling didn't make any mistakes
    await validateFile(projectRoot, file, {
      binaryMapData,
      moduleResolveMapLocation: join(outputDir, 'module-resolve-map.json'),
      logger,
      workspaceMap,
      stubbedExternals,
      // Everything the build treats as external: what the config resolved to, plus what analysis
      // discovered. Any of these can be stubbed on demand when it breaks validation.
      externalizablePackages: [...mergedExternals, ...result.externalDependencies.keys()],
      externalsPreset,
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
    platform,
    isDev = false,
    bundlerOptions,
  }: {
    outputDir: string;
    projectRoot: string;
    platform: BundlerPlatform;
    isDev?: boolean;
    bundlerOptions?: Pick<BundlerOptions, 'externals' | 'enableSourcemap' | 'dynamicPackages'> | null;
  },
  logger: IMastraLogger,
) {
  const mastraConfig = await readFile(mastraEntry, 'utf-8');
  const mastraConfigResult: { hasValidConfig: boolean; projectType?: string } = { hasValidConfig: false };

  await transformAsync(mastraConfig, {
    filename: mastraEntry,
    presets: [import.meta.resolve('@babel/preset-typescript')],
    plugins: [() => checkConfigExport(mastraConfigResult)],
  });

  if (!mastraConfigResult.hasValidConfig) {
    logger.warn('Invalid Mastra config', {
      details:
        'Please make sure that your entry file looks like this:\nexport const mastra = new Mastra({\n  // your options\n})\n\nIf you think your configuration is valid, please open an issue.',
    });
  }

  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile: mastraEntry });

  const { externalsPreset, mergedExternals } = normalizeExternals(bundlerOptions?.externals);
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
  for (const entry of entries) {
    const isVirtualFile = entry.includes('\n') || !existsSync(entry);
    const analyzeResult = await analyzeEntry({ entry, isVirtualFile }, mastraEntry, {
      logger,
      sourcemapEnabled: bundlerOptions?.enableSourcemap ?? false,
      workspaceMap,
      projectRoot,
      shouldCheckTransitiveDependencies: true,
      analyzeCache,
    });

    // Detect pino transports in the bundled output
    transformSync(analyzeResult.output.code, {
      filename: 'pino-detection.js',
      plugins: [() => detectPinoTransports(detectedPinoTransports)],
      configFile: false,
      babelrc: false,
      code: false,
    });

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

  const { output, fileNameToDependencyMap, usedExternals } = await bundleExternals(depsToOptimize, outputDir, {
    bundlerOptions: {
      externalsPreset,
      mergedExternals,
      isDev,
    },
    projectRoot,
    workspaceRoot,
    workspaceMap,
    platform,
  });

  // Filesystem-relative workspace paths for filtering workspace imports from rollup output.
  // Normalize to forward slashes so the startsWith check works on Windows where
  // path.relative() produces backslashes but rollup uses forward slashes.
  const relativeWorkspaceFolderPaths = Array.from(workspaceMap.values()).map(pkgInfo =>
    slash(relative(workspaceRoot || projectRoot, pkgInfo.location)),
  );

  for (const o of output) {
    if (o.type === 'asset') {
      continue;
    }

    const importerId = getLastConcreteModuleId(o.moduleIds);

    for (const i of o.imports) {
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
        );
        allUsedExternals.set(pkgName, preferDependencyInfo(allUsedExternals.get(pkgName), dependencyInfo));
      }
    }
  }

  const result = await validateOutput(
    {
      output,
      reverseVirtualReferenceMap: fileNameToDependencyMap,
      usedExternals,
      mergedExternals,
      externalsPreset,
      outputDir,
      projectRoot: workspaceRoot || projectRoot,
      workspaceMap,
      depsVersionInfo,
    },
    logger,
  );

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
      mergedExternalDeps.set(dep, await resolveDependencyInfo(dep, info, externalMetadataParentPaths));
    }
  }

  // Add pino transports and user dynamic packages
  for (const transport of detectedPinoTransports) {
    if (!mergedExternalDeps.has(transport)) {
      mergedExternalDeps.set(transport, await resolveDependencyInfo(transport, undefined, externalMetadataParentPaths));
    }
  }
  for (const pkg of userDynamicPackages) {
    if (!mergedExternalDeps.has(pkg)) {
      mergedExternalDeps.set(pkg, await resolveDependencyInfo(pkg, undefined, externalMetadataParentPaths));
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
  };
}
