import { availableParallelism } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { IMastraLogger } from '@internal/core/logger';
import { resolveModule } from 'local-pkg';
import { rolldown } from 'rolldown';
import type { Plugin, SourceMap } from 'rolldown';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { mastraInternalAliasPlugin, mastraToolsAliasPlugin } from '../bundler';
import { getPackageMetadata, getPackageRootPath } from '../package-info';
import type { PackageLookupCache } from '../package-info';
import { moduleAlias } from '../plugins/module-alias';
import { removeDeployer } from '../plugins/remove-deployer';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import {
  EXTERNAL_PROTOCOL_RE,
  bareExternals,
  bundlerLogLevel,
  extractImportedBindings,
  getPlatformOptions,
  packagesRegex,
  scopedDefine,
  stripViteIgnore,
  VIRTUAL_PREFIX,
  virtualModules,
} from '../rolldown';
import type { DependencyMetadata } from '../types';
import { getPackageName, isBareModuleSpecifier, slash } from '../utils';
import type { BundlerPlatform } from '../utils';
import { DEPS_TO_IGNORE } from './constants';

/**
 * Configures the Rolldown plugins used to analyze entry files.
 *
 * Every bare import stays external (workspace packages are analyzed recursively instead), which is what Rollup did
 * implicitly by leaving unresolved imports external. `externals`/`externalsPreset` therefore don't change this pass.
 */
function getInputPlugins(
  { entry, isVirtualFile }: { entry: string; isVirtualFile: boolean },
  mastraEntry: string,
  {
    sourcemapEnabled,
    env,
    alias,
    platform,
    requiredExternals,
  }: {
    sourcemapEnabled: boolean;
    env: Record<string, string>;
    alias: Record<string, string>;
    platform: BundlerPlatform;
    requiredExternals: Set<string>;
  },
): Plugin[] {
  const plugins: (Plugin | null)[] = [
    isVirtualFile ? virtualModules({ '#entry': entry }) : null,
    mastraInternalAliasPlugin(mastraEntry, { preserveSymlinks: true }),
    moduleAlias(alias, mastraEntry, platform),
    mastraToolsAliasPlugin(),
    tsConfigPaths(),
    scopedDefine(env),
    stripViteIgnore(),
    removeDeployer(mastraEntry, {
      sourcemap: sourcemapEnabled,
    }),
    bareExternals({
      onExternal: (id, kind) => {
        if (kind === 'require-call') {
          requiredExternals.add(id);
        }
      },
    }),
  ];

  return plugins.filter(plugin => plugin !== null);
}

type EntryConfig = { entry: string; isVirtualFile: boolean };

/** Options that shape the Rolldown pass over an entry. */
export type EntryScanOptions = {
  sourcemapEnabled: boolean;
  env: Record<string, string>;
  alias: Record<string, string>;
  platform: BundlerPlatform;
  workspaceMap: Map<string, WorkspacePackageInfo>;
  projectRoot: string;
  packageLookupCache?: PackageLookupCache;
};

/**
 * The Rolldown pass over one entry plus the metadata of its static imports. It depends on the entry and the build
 * options only, not on the dependency path that reached the entry, so analyses running side by side can share it.
 */
export type EntryScan = {
  facadeModuleId: string;
  /** Root of the package the entry belongs to, where its dependencies are looked up */
  entryRootPath: string;
  dependencies: Map<string, DependencyMetadata>;
  dynamicImports: string[];
  output: AnalyzeEntryResult['output'];
  /** `resolveModule` results for workspace dependencies, filled on first use */
  workspaceEntries: Map<string, string | undefined>;
};

// A pass is mostly Rust work off the main thread, so a few at once overlap without flooding the thread pool.
const ANALYZE_CONCURRENCY = Math.max(1, Math.min(4, availableParallelism()));

/**
 * Runs entry scans with bounded concurrency and shares each one between the analyses that need it.
 *
 * A scan never waits on another scan, so scans can be started ahead of the sequential dependency walk that consumes
 * them without any risk of deadlock on dependency cycles, and the walk produces the same result in the same order as
 * when every scan ran inline.
 *
 * Use one scanner per analysis: scans are keyed by entry only, so the {@link EntryScanOptions} must not change.
 */
export type EntryScanner = {
  scan(key: string, run: () => Promise<EntryScan>): Promise<EntryScan>;
  /** Cancels queued scans and waits for running ones, so no pass outlives a failed analysis. */
  close(): Promise<void>;
};

export function createEntryScanner(concurrency = ANALYZE_CONCURRENCY): EntryScanner {
  const scans = new Map<string, Promise<EntryScan>>();
  const waiting: Array<() => void> = [];
  let running = 0;
  let closed = false;

  async function runLimited(run: () => Promise<EntryScan>): Promise<EntryScan> {
    if (running < concurrency) {
      running++;
    } else {
      // The finishing scan hands its slot over without decrementing `running`.
      await new Promise<void>(resolve => waiting.push(resolve));
    }

    try {
      if (closed) {
        throw new Error('Entry analysis was cancelled');
      }
      return await run();
    } finally {
      const next = waiting.shift();
      if (next) {
        next();
      } else {
        running--;
      }
    }
  }

  return {
    scan(key, run) {
      let scan = scans.get(key);
      if (!scan) {
        scan = runLimited(run);
        // Scans started ahead of time are never awaited when an earlier entry fails first.
        scan.catch(() => {});
        scans.set(key, scan);
      }
      return scan;
    },
    async close() {
      closed = true;
      await Promise.allSettled(scans.values());
    },
  };
}

async function runEntryScan(
  { entry, isVirtualFile }: EntryConfig,
  mastraEntry: string,
  { sourcemapEnabled, env, alias, platform, workspaceMap, projectRoot, packageLookupCache }: EntryScanOptions,
): Promise<EntryScan> {
  const requiredExternals = new Set<string>();
  const optimizerBundler = await rolldown({
    logLevel: bundlerLogLevel(),
    input: isVirtualFile ? '#entry' : entry,
    // Relative imports from the virtual entry resolve against the cwd, like Rollup did.
    cwd: process.cwd(),
    treeshake: false,
    ...getPlatformOptions(platform, { preserveSymlinks: true }),
    plugins: getInputPlugins({ entry, isVirtualFile }, mastraEntry, {
      sourcemapEnabled,
      env,
      alias,
      platform,
      requiredExternals,
    }),
    external: [EXTERNAL_PROTOCOL_RE, packagesRegex(DEPS_TO_IGNORE)!],
  });

  const { output } = await (async () => {
    try {
      return await optimizerBundler.generate({
        format: 'esm',
        codeSplitting: false,
      });
    } finally {
      await optimizerBundler.close();
    }
  })();

  const chunk = output[0];
  const { importedBindings, dynamicImports } = extractImportedBindings(chunk.code, requiredExternals);

  if (!chunk.facadeModuleId) {
    throw new Error(
      'Something went wrong, we could not find the package name of the entry file. Please open an issue.',
    );
  }

  let entryRootPath = projectRoot;
  if (!chunk.facadeModuleId.startsWith(VIRTUAL_PREFIX)) {
    entryRootPath = (await getPackageRootPath(chunk.facadeModuleId, undefined, packageLookupCache)) || projectRoot;
  }

  const dependencies = new Map<string, DependencyMetadata>();
  for (const [dependency, bindings] of Object.entries(importedBindings)) {
    if (!isBareModuleSpecifier(dependency)) {
      continue;
    }

    // The `getPackageName` helper also handles subpaths so we only get the proper package name
    const pkgName = getPackageName(dependency);
    let rootPath: string | null = null;
    let isWorkspace = false;
    let version: string | undefined;
    let packageSpec: string | undefined;

    if (pkgName) {
      const metadata = await getPackageMetadata(dependency, entryRootPath, packageLookupCache);
      rootPath = metadata.rootPath;
      version = metadata.version;
      packageSpec = metadata.packageSpec;
      isWorkspace = workspaceMap.has(pkgName);
    }

    const normalizedRootPath = rootPath ? slash(rootPath) : null;

    dependencies.set(dependency, {
      exports: bindings,
      rootPath: normalizedRootPath,
      isWorkspace,
      version,
      packageSpec,
    });
  }

  return {
    facadeModuleId: chunk.facadeModuleId,
    entryRootPath,
    dependencies,
    dynamicImports,
    output: {
      code: chunk.code,
      map: chunk.map,
    },
    workspaceEntries: new Map(),
  };
}

function scanEntry(
  entryConfig: EntryConfig,
  mastraEntry: string,
  options: EntryScanOptions,
  scanner: EntryScanner,
): Promise<EntryScan> {
  // A virtual entry has no path; its code identifies it.
  const key = entryConfig.isVirtualFile ? `virtual:${entryConfig.entry}` : slash(entryConfig.entry);
  return scanner.scan(key, () => runEntryScan(entryConfig, mastraEntry, options));
}

/**
 * Starts the Rolldown pass for an entry so that a later {@link analyzeEntry} call with the same scanner and options
 * picks it up instead of starting it then.
 */
export function prefetchEntry(
  entryConfig: EntryConfig,
  mastraEntry: string,
  options: EntryScanOptions,
  scanner: EntryScanner,
): void {
  void scanEntry(entryConfig, mastraEntry, options, scanner);
}

type AnalyzeCacheKeyOptions = {
  shouldCheckTransitiveDependencies: boolean;
  externals: string[];
  externalsPreset: boolean;
};

function getAnalyzeCacheKey(
  resolvedEntry: string,
  { shouldCheckTransitiveDependencies, externals, externalsPreset }: AnalyzeCacheKeyOptions,
) {
  // Transitive analysis produces a different result from direct analysis, so cache them separately.
  const externalsCacheKey = JSON.stringify([externalsPreset, [...externals].sort()]);
  return `${resolvedEntry}:${shouldCheckTransitiveDependencies ? 'transitive' : 'direct'}:${externalsCacheKey}`;
}

/**
 * Adds the transitive workspace dependencies and the dynamic imports of a scanned entry to its static imports.
 * Workspace dependencies are analyzed recursively, one after another in import order, so the result doesn't depend
 * on which scan finishes first.
 */
async function captureDependenciesToOptimize(
  scan: EntryScan,
  {
    logger,
    mastraEntry,
    shouldCheckTransitiveDependencies,
    analyzeCache,
    activeEntries,
    scanner,
    scanOptions,
    externals,
    externalsPreset,
  }: {
    logger: IMastraLogger;
    mastraEntry: string;
    shouldCheckTransitiveDependencies: boolean;
    /** Shared cache to avoid re-analyzing the same entry across recursive calls */
    analyzeCache: Map<string, AnalyzeEntryResult>;
    /** Resolved entries currently being analyzed in this recursion path */
    activeEntries: Set<string>;
    scanner: EntryScanner;
    scanOptions: EntryScanOptions;
    externals: string[];
    externalsPreset: boolean;
  },
): Promise<Map<string, DependencyMetadata>> {
  const { projectRoot, packageLookupCache } = scanOptions;
  const depsToOptimize = new Map(scan.dependencies);

  function resolveWorkspaceEntry(dep: string): string | undefined {
    if (!scan.workspaceEntries.has(dep)) {
      const importerFile = scan.facadeModuleId.startsWith(VIRTUAL_PREFIX)
        ? mastraEntry || projectRoot
        : scan.facadeModuleId;
      const importerPath = pathToFileURL(importerFile).href;
      // Absolute path to the dependency using ESM-compatible resolution
      scan.workspaceEntries.set(dep, resolveModule(dep, { paths: [importerPath] }));
    }
    return scan.workspaceEntries.get(dep);
  }

  const processedWorkspaceEntries = new Set<string>();

  /**
   * Recursively discovers transitive workspace dependencies from package manifests.
   */
  async function checkTransitiveDependencies() {
    const workspaceDeps = [...depsToOptimize]
      .filter(([dep, meta]) => getPackageName(dep) && meta.isWorkspace)
      .map(([dep]) => dep);
    const transitiveScanOptions = { ...scanOptions, sourcemapEnabled: false };
    const transitiveCacheKeyOptions = { shouldCheckTransitiveDependencies: true, externals, externalsPreset };

    // Start the scans of the workspace dependencies the loop below analyzes.
    for (const dep of workspaceDeps) {
      const resolvedPath = resolveWorkspaceEntry(dep);
      if (!resolvedPath) {
        continue;
      }

      const resolvedEntry = slash(resolvedPath);
      if (
        !activeEntries.has(resolvedEntry) &&
        !analyzeCache.has(getAnalyzeCacheKey(resolvedEntry, transitiveCacheKeyOptions))
      ) {
        prefetchEntry({ entry: resolvedPath, isVirtualFile: false }, mastraEntry, transitiveScanOptions, scanner);
      }
    }

    for (const dep of workspaceDeps) {
      const resolvedPath = resolveWorkspaceEntry(dep);

      if (!resolvedPath) {
        logger.warn('Could not resolve path for workspace dependency', { dep });
        continue;
      }

      const resolvedEntry = slash(resolvedPath);
      if (processedWorkspaceEntries.has(resolvedEntry) || activeEntries.has(resolvedEntry)) {
        continue;
      }

      processedWorkspaceEntries.add(resolvedEntry);

      const analysis = await analyzeEntry({ entry: resolvedPath, isVirtualFile: false }, mastraEntry, {
        ...transitiveScanOptions,
        logger,
        shouldCheckTransitiveDependencies: true,
        analyzeCache,
        activeEntries,
        scanner,
        externals,
        externalsPreset,
      });

      if (!analysis?.dependencies) {
        continue;
      }

      for (const [innerDep, innerMeta] of analysis.dependencies) {
        if (!innerMeta.isWorkspace) {
          continue;
        }

        const existingMeta = depsToOptimize.get(innerDep);
        if (existingMeta) {
          depsToOptimize.set(innerDep, {
            ...existingMeta,
            exports: [...new Set([...existingMeta.exports, ...innerMeta.exports])],
          });
          continue;
        } else {
          depsToOptimize.set(innerDep, {
            exports: innerMeta.exports,
            rootPath: slash(innerMeta.rootPath || ''),
            isWorkspace: true,
            version: innerMeta.version,
          });
        }
      }
    }
  }

  if (shouldCheckTransitiveDependencies) {
    await checkTransitiveDependencies();
  }

  // #tools is a generated dependency, we don't want our analyzer to handle it
  const dynamicImports = scan.dynamicImports.filter(d => !DEPS_TO_IGNORE.includes(d));
  if (dynamicImports.length) {
    for (const dynamicImport of dynamicImports) {
      if (!depsToOptimize.has(dynamicImport) && isBareModuleSpecifier(dynamicImport)) {
        // Try to resolve version for dynamic imports as well
        const pkgName = getPackageName(dynamicImport);
        let version: string | undefined;
        let packageSpec: string | undefined;
        let rootPath: string | null = null;

        if (pkgName) {
          const metadata = await getPackageMetadata(dynamicImport, scan.entryRootPath, packageLookupCache);
          rootPath = metadata.rootPath;
          version = metadata.version;
          packageSpec = metadata.packageSpec;
        }

        depsToOptimize.set(dynamicImport, {
          exports: ['*'],
          rootPath: rootPath ? slash(rootPath) : null,
          isWorkspace: false,
          version,
          packageSpec,
        });
      }
    }
  }

  return depsToOptimize;
}

/** Return type of {@link analyzeEntry} */
export type AnalyzeEntryResult = {
  dependencies: Map<string, DependencyMetadata>;
  output: {
    code: string;
    map: SourceMap | null;
  };
};

/**
 * Analyzes the entry file to identify external dependencies and their imports. This allows us to treeshake all code that is not used.
 *
 * @param entryConfig - Configuration object for the entry file
 * @param entryConfig.entry - The entry file path or content
 * @param entryConfig.isVirtualFile - Whether the entry is a virtual file (content string) or a file path
 * @param mastraEntry - The mastra entry point
 * @param options - Configuration options for the analysis
 * @param options.logger - Logger instance for debugging
 * @param options.sourcemapEnabled - Whether sourcemaps are enabled
 * @param options.workspaceMap - Map of workspace packages
 * @param options.shouldCheckTransitiveDependencies - Whether to recursively analyze transitive workspace dependencies (default: false)
 * @returns A promise that resolves to an object containing the analyzed dependencies and generated output
 */
export async function analyzeEntry(
  { entry, isVirtualFile }: EntryConfig,
  mastraEntry: string,
  {
    logger,
    sourcemapEnabled,
    workspaceMap,
    projectRoot,
    env = { 'process.env.NODE_ENV': JSON.stringify('production') },
    shouldCheckTransitiveDependencies = false,
    analyzeCache,
    activeEntries: providedActiveEntries,
    scanner: providedScanner,
    packageLookupCache,
    externals = [],
    externalsPreset = false,
    alias = {},
    platform = 'node',
  }: {
    logger: IMastraLogger;
    sourcemapEnabled: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectRoot: string;
    env?: Record<string, string>;
    shouldCheckTransitiveDependencies?: boolean;
    /** Shared cache to avoid re-analyzing the same entry across recursive calls */
    analyzeCache?: Map<string, AnalyzeEntryResult>;
    /** Resolved entries currently being analyzed in this recursion path */
    activeEntries?: Set<string>;
    /** Shares Rolldown passes between calls, including passes started with {@link prefetchEntry} */
    scanner?: EntryScanner;
    /** Package lookups memoized for the current build */
    packageLookupCache?: PackageLookupCache;
    /** Dependencies that must remain external during analysis */
    externals?: string[];
    /** Whether all non-workspace dependencies must remain external during analysis */
    externalsPreset?: boolean;
    /** Exact module specifier aliases applied before externalization */
    alias?: Record<string, string>;
    platform?: BundlerPlatform;
  },
): Promise<AnalyzeEntryResult> {
  const resolvedEntry = isVirtualFile ? undefined : slash(entry);
  const effectiveAnalyzeCache = analyzeCache ?? new Map<string, AnalyzeEntryResult>();
  const cacheKey = resolvedEntry
    ? getAnalyzeCacheKey(resolvedEntry, { shouldCheckTransitiveDependencies, externals, externalsPreset })
    : undefined;
  if (cacheKey && effectiveAnalyzeCache.has(cacheKey)) {
    return effectiveAnalyzeCache.get(cacheKey)!;
  }

  const activeEntries = providedActiveEntries ?? new Set<string>();
  const shouldTrackEntry = Boolean(resolvedEntry && !activeEntries.has(resolvedEntry));
  if (resolvedEntry && shouldTrackEntry) {
    activeEntries.add(resolvedEntry);
  }

  const scanner = providedScanner ?? createEntryScanner();
  const scanOptions: EntryScanOptions = {
    sourcemapEnabled,
    env,
    alias,
    platform,
    workspaceMap,
    projectRoot,
    packageLookupCache,
  };

  try {
    const scan = await scanEntry({ entry, isVirtualFile }, mastraEntry, scanOptions, scanner);
    const depsToOptimize = await captureDependenciesToOptimize(scan, {
      logger,
      mastraEntry,
      shouldCheckTransitiveDependencies,
      analyzeCache: effectiveAnalyzeCache,
      activeEntries,
      scanner,
      scanOptions,
      externals,
      externalsPreset,
    });

    const result: AnalyzeEntryResult = {
      dependencies: depsToOptimize,
      output: scan.output,
    };

    // Cache the result so recursive calls for the same entry are instant
    if (cacheKey) {
      effectiveAnalyzeCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    // Workspace dependencies prefetched by this call may still be scanning.
    if (!providedScanner) {
      await scanner.close();
    }
    throw error;
  } finally {
    if (resolvedEntry && shouldTrackEntry) {
      activeEntries.delete(resolvedEntry);
    }
  }
}
