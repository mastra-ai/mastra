import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { basename } from 'node:path/posix';
import * as resolve from 'resolve.exports';
import { rolldown } from 'rolldown';
import type { OutputChunk, OutputAsset, Plugin } from 'rolldown';
import { esmExternalRequirePlugin } from 'rolldown/plugins';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { aliasHono } from '../plugins/hono-alias';
import { missingNativeBuildResolver } from '../plugins/missing-native-build';
import { moduleAlias } from '../plugins/module-alias';
import { nodeGypDetector } from '../plugins/node-gyp-detector';
import { subpathExternals } from '../plugins/subpath-externals-resolver';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import {
  EXTERNAL_PROTOCOL_RE,
  bareExternals,
  bundlerLogLevel,
  cjsGlobalsDefine,
  exactIdsRegex,
  getPlatformOptions,
  lodashImports,
  virtualModules,
} from '../rolldown';
import type { DependencyMetadata } from '../types';
import { getCompiledDepCachePath, isDependencyPartOfPackage, rollupSafeName, slash } from '../utils';
import type { BundlerPlatform } from '../utils';
import { DEPS_TO_IGNORE } from './constants';
import type { NormalizedExternals } from './externals';

type VirtualDependency = {
  name: string;
  virtual: string;
};

function prepareEntryFileName(name: string, rootDir: string) {
  return rollupSafeName(name, rootDir);
}

/**
 * Creates virtual dependency modules for optimized bundling by generating virtual entry points for each dependency with their specific exports and handling workspace package path resolution.
 */
export function createVirtualDependencies(
  depsToOptimize: Map<string, DependencyMetadata>,
  {
    projectRoot,
    workspaceRoot,
    outputDir,
    bundlerOptions,
  }: {
    workspaceRoot: string | null;
    projectRoot: string;
    outputDir: string;
    bundlerOptions?: { isDev?: boolean; externalsPreset?: boolean };
  },
): {
  optimizedDependencyEntries: Map<string, VirtualDependency>;
  fileNameToDependencyMap: Map<string, string>;
} {
  const { isDev = false, externalsPreset = false } = bundlerOptions || {};
  const fileNameToDependencyMap = new Map<string, string>();
  const optimizedDependencyEntries = new Map<string, VirtualDependency>();
  const rootDir = workspaceRoot || projectRoot;

  for (const [dep, { exports }] of depsToOptimize.entries()) {
    // Use __ as separator to avoid conflicts with hyphens in package names
    // e.g., @inner/inner-tools -> @inner__inner-tools (preserves the hyphen)
    const fileName = dep.replaceAll('/', '__');
    const virtualFile: string[] = [];
    const exportStringBuilder = [];

    for (const local of exports) {
      if (local === '*') {
        virtualFile.push(`export * from '${dep}';`);
        continue;
      } else if (local === 'default') {
        exportStringBuilder.push('default');
      } else {
        exportStringBuilder.push(local);
      }
    }

    const chunks = [];
    if (exportStringBuilder.length) {
      chunks.push(`{ ${exportStringBuilder.join(', ')} }`);
    }
    if (chunks.length) {
      virtualFile.push(`export ${chunks.join(', ')} from '${dep}';`);
    }

    // Determine the entry name based on the complexity of exports
    let entryName = prepareEntryFileName(path.join(outputDir, fileName), rootDir);

    fileNameToDependencyMap.set(entryName, dep);
    optimizedDependencyEntries.set(dep, {
      name: entryName,
      virtual: virtualFile.join('\n'),
    });
  }

  // For workspace packages, we still want the dependencies to be imported from the original path
  // We rewrite the path to the original folder inside node_modules/.cache
  if (isDev || externalsPreset) {
    for (const [dep, { isWorkspace, rootPath }] of depsToOptimize.entries()) {
      if (!isWorkspace || !rootPath || !workspaceRoot) {
        continue;
      }

      const currentDepPath = optimizedDependencyEntries.get(dep);
      if (!currentDepPath) {
        continue;
      }

      const fileName = basename(currentDepPath.name);
      const entryName = prepareEntryFileName(getCompiledDepCachePath(rootPath, fileName), rootDir);

      fileNameToDependencyMap.set(entryName, dep);
      optimizedDependencyEntries.set(dep, {
        ...currentDepPath,
        name: entryName,
      });
    }
  }

  return { optimizedDependencyEntries, fileNameToDependencyMap };
}

/**
 * Configures the Rolldown plugins for bundling external dependencies.
 *
 * TypeScript in workspace packages (and `transpilePackages`) is handled by Rolldown's built-in transform, and
 * CommonJS/JSON natively, so only resolution concerns are left as plugins.
 */
function getInputPlugins(
  virtualDependencies: Map<string, { name: string; virtual: string }>,
  {
    workspaceMap,
    bundlerOptions,
    projectRoot,
    rootDir,
    externals,
    platform,
    alias,
    requiredExternals,
  }: {
    workspaceMap: Map<string, WorkspacePackageInfo>;
    bundlerOptions: { noBundling: boolean };
    projectRoot: string;
    rootDir: string;
    externals: string[];
    platform: BundlerPlatform;
    alias: Record<string, string>;
    requiredExternals: Set<string>;
  },
): Plugin[] {
  const subpath = subpathExternals(externals, workspaceMap);
  const virtualDependencyIds = exactIdsRegex(virtualDependencies.keys());

  const plugins: (Plugin | null)[] = [
    virtualModules(
      Object.fromEntries(
        Array.from(virtualDependencies.entries()).map(([dep, virtualDep]) => [`#virtual-${dep}`, virtualDep.virtual]),
      ),
      { name: 'virtual-dependencies' },
    ),
    // Built-in: externals that are `require()`d become hoisted imports, like `@rollup/plugin-commonjs` did, so they
    // show up in `chunk.imports` and can be stubbed during validation.
    subpath.patterns.length ? (esmExternalRequirePlugin({ external: subpath.patterns }) as unknown as Plugin) : null,
    moduleAlias(alias, path.join(rootDir, 'package.json'), platform),
    tsConfigPaths({ cwd: projectRoot }),
    subpath.plugin,
    bundlerOptions.noBundling && virtualDependencyIds
      ? ({
          name: 'alias-optimized-deps',
          resolveId: {
            filter: { id: virtualDependencyIds },
            async handler(id, importer, options) {
              const info = virtualDependencies.get(id)!;
              // go from ./node_modules/.cache/index.js to ./pkg
              const packageRootPath = path.join(rootDir, path.dirname(path.dirname(path.dirname(info.name))));
              const pkgJsonBuffer = await readFile(path.join(packageRootPath, 'package.json'), 'utf-8');
              const pkgJson = JSON.parse(pkgJsonBuffer);
              if (!pkgJson) {
                return null;
              }

              const pkgName = pkgJson.name || '';
              let resolvedPath: string | undefined = resolve.exports(pkgJson, id.replace(pkgName, '.'))?.[0];
              if (!resolvedPath) {
                resolvedPath = pkgJson!.main ?? 'index.js';
              }

              return this.resolve(path.posix.join(packageRootPath, resolvedPath!), importer, {
                ...options,
                skipSelf: true,
              });
            },
          },
        } satisfies Plugin)
      : null,
    lodashImports(),
    // hono is imported from deployer, so it falls back to resolving from here
    aliasHono({ preferProject: !bundlerOptions.noBundling }),
    // Without bundling, node_modules stay external (Rollup had no resolver in this mode).
    bundlerOptions.noBundling
      ? bareExternals({
          onExternal: (id, kind) => {
            // `require()` of an external stays a lazy `createRequire` call, which `chunk.imports` doesn't list.
            if (kind === 'require-call') {
              requiredExternals.add(id);
            }
          },
        })
      : null,
    nodeGypDetector(),
    missingNativeBuildResolver(),
  ];

  return plugins.filter(plugin => plugin !== null);
}

/**
 * Executes the Rolldown build for virtual dependencies using configured plugins.
 * Bundles all virtual dependency modules into optimized ESM files with proper external handling.
 */
async function buildExternalDependencies(
  virtualDependencies: Map<string, VirtualDependency>,
  {
    externals,
    workspaceMap,
    projectRoot,
    rootDir,
    outputDir,
    bundlerOptions,
    platform,
    alias,
    requiredExternals,
  }: {
    externals: string[];
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectRoot: string;
    rootDir: string;
    outputDir: string;
    bundlerOptions: {
      isDev: boolean;
      externalsPreset: boolean;
    };
    platform: BundlerPlatform;
    alias: Record<string, string>;
    requiredExternals: Set<string>;
  },
) {
  /**
   * If there are no virtual dependencies to bundle, return an empty array to avoid Rolldown errors.
   */
  if (virtualDependencies.size === 0) {
    return [] as unknown as [OutputChunk, ...(OutputAsset | OutputChunk)[]];
  }

  const noBundling = bundlerOptions.isDev || bundlerOptions.externalsPreset;
  const aliasSources = new Set(Object.keys(alias));

  const plugins = getInputPlugins(virtualDependencies, {
    workspaceMap,
    bundlerOptions: {
      noBundling,
    },
    projectRoot,
    rootDir,
    externals: externals.filter(external => !aliasSources.has(external)),
    platform,
    alias,
    requiredExternals,
  });

  const bundler = await rolldown({
    logLevel: bundlerLogLevel(),
    input: Array.from(virtualDependencies.entries()).reduce<Record<string, string>>((acc, [dep, virtualDep]) => {
      acc[virtualDep.name] = `#virtual-${dep}`;
      return acc;
    }, {}),
    cwd: projectRoot,
    ...getPlatformOptions(platform, { modules: [path.join(rootDir, 'node_modules')] }),
    // Without bundling these files are loaded as-is at runtime, so CommonJS globals need the ESM shim here.
    transform: { target: 'node20', define: cjsGlobalsDefine(noBundling, platform) },
    external: [EXTERNAL_PROTOCOL_RE],
    treeshake: !noBundling,
    plugins,
  });

  const outputDirRelative = prepareEntryFileName(outputDir, rootDir);
  // Module ids are real paths, so workspace locations must be too.
  const workspaceLocations = Array.from(workspaceMap.entries()).map(([pkgName, pkgInfo]) => {
    let location = pkgInfo.location;
    try {
      location = realpathSync(location);
    } catch {}
    return [pkgName, slash(location)] as const;
  });

  const { output } = await bundler.write({
    format: 'esm',
    dir: rootDir,
    entryFileNames: '[name].mjs',
    // used to get the filename of the actual error
    sourcemap: true,
    /**
     * Rollup creates chunks for common dependencies, but these chunks are by default written to the root directory instead of respecting the entryFileNames structure.
     * So we want to write them to the `.mastra/output` folder as well.
     */
    chunkFileNames: chunkInfo => {
      /**
       * This whole bunch of logic directly below is for the edge case shown in the e2e-tests/monorepo with "tinyrainbow" package. It's used in multiple places in the package and as such Rollup creates a shared chunk for it. During 'mastra dev' / with externals: true, we don't want that chunk to show up in the '.mastra/output' folder (outputDirRelative) but inside <pkg>/node_modules/.cache instead.
       * We only care about this for the "noBundling" case!
       */
      if (noBundling) {
        const importedFromPackages = new Set<string>();

        for (const moduleId of chunkInfo.moduleIds) {
          const normalized = slash(moduleId);
          for (const [pkgName, location] of workspaceLocations) {
            if (normalized.startsWith(location)) {
              importedFromPackages.add(pkgName);
              break;
            }
          }
        }

        // A chunk spanning multiple workspace packages has no single owning cache dir, so it falls through to the output dir.
        if (importedFromPackages.size === 1) {
          const [pkgName] = importedFromPackages;
          const workspaceLocation = workspaceMap.get(pkgName!)!.location;
          return prepareEntryFileName(getCompiledDepCachePath(workspaceLocation, '[name].mjs'), rootDir);
        }
      }

      return `${outputDirRelative}/[name].mjs`;
    },
    assetFileNames: `${outputDirRelative}/[name][extname]`,
  });

  await bundler.close();

  return output;
}

/**
 * Recursively searches through Rollup output chunks to find which module imports a specific external dependency.
 * Used to build the module resolution map for proper external dependency tracking.
 */
function findExternalImporter(
  module: OutputChunk,
  external: string,
  allOutputs: OutputChunk[],
  visited = new Set<string>(),
): OutputChunk | null {
  if (visited.has(module.fileName)) {
    return null;
  }

  visited.add(module.fileName);
  const capturedFiles = new Set<string>();

  for (const id of [...module.imports, ...module.dynamicImports]) {
    if (isDependencyPartOfPackage(id, external)) {
      return module;
    } else if (id.endsWith('.mjs')) {
      capturedFiles.add(id);
    }
  }

  for (const file of capturedFiles) {
    const nextModule = allOutputs.find(o => o.fileName === file);
    if (nextModule) {
      const importer = findExternalImporter(nextModule, external, allOutputs, visited);

      if (importer) {
        return importer;
      }
    }
  }

  return null;
}

/**
 * Bundles vendor dependencies identified in the analysis step.
 * Creates virtual modules for each dependency and bundles them using rollup.
 *
 * @param depsToOptimize - Map of dependencies to optimize with their metadata (exported bindings, rootPath, isWorkspace)
 * @param outputDir - Directory where bundled files will be written
 * @param logger - Logger instance for debugging
 * @returns Object containing bundle output and reference map for validation
 */
export async function bundleExternals(
  depsToOptimize: Map<string, DependencyMetadata>,
  outputDir: string,
  options: {
    bundlerOptions: NormalizedExternals & {
      isDev?: boolean;
      transpilePackages?: string[];
      alias?: Record<string, string>;
    };
    projectRoot?: string;
    workspaceRoot?: string;
    workspaceMap?: Map<string, WorkspacePackageInfo>;
    platform?: BundlerPlatform;
  },
) {
  const {
    workspaceRoot = null,
    workspaceMap = new Map(),
    projectRoot = outputDir,
    bundlerOptions,
    platform = 'node',
  } = options;
  // `transpilePackages` needs no handling anymore: Rolldown transpiles TypeScript in every module.
  const { externalsPreset, mergedExternals, isDev = false, alias = {} } = bundlerOptions;

  /**
   * When externals: true, we need to extract non-workspace deps from depsToOptimize
   * and add them directly to usedExternals instead of bundling them.
   */
  const extractedExternals = new Map<string, string>();
  if (externalsPreset) {
    for (const [dep, metadata] of depsToOptimize.entries()) {
      if (!metadata.isWorkspace) {
        // Add to extracted externals - use rootPath or fallback to package name
        extractedExternals.set(dep, metadata.rootPath ?? dep);
        // Remove from depsToOptimize so it won't be bundled
        depsToOptimize.delete(dep);
      }
    }
  }

  const { optimizedDependencyEntries, fileNameToDependencyMap } = createVirtualDependencies(depsToOptimize, {
    workspaceRoot,
    outputDir,
    projectRoot,
    bundlerOptions: {
      isDev,
      externalsPreset,
    },
  });

  const requiredExternals = new Set<string>();
  const output = await buildExternalDependencies(optimizedDependencyEntries, {
    externals: mergedExternals,
    requiredExternals,
    workspaceMap,
    projectRoot,
    rootDir: workspaceRoot || projectRoot,
    outputDir,
    bundlerOptions: {
      isDev,
      externalsPreset,
    },
    platform,
    alias,
  });

  const moduleResolveMap = new Map<string, Map<string, string>>();
  const filteredChunks = output.filter(o => o.type === 'chunk');

  for (const o of filteredChunks.filter(o => o.isEntry || o.isDynamicEntry)) {
    for (const external of mergedExternals) {
      if (DEPS_TO_IGNORE.includes(external)) {
        continue;
      }

      const importer = findExternalImporter(o, external, filteredChunks);

      if (importer) {
        const fullPath = path.join(workspaceRoot || projectRoot, importer.fileName);
        let innerMap = moduleResolveMap.get(fullPath);

        if (!innerMap) {
          innerMap = new Map<string, string>();
          moduleResolveMap.set(fullPath, innerMap);
        }

        // Skip virtual ids (`\0virtual:#virtual-*`, `\0rolldown/runtime.js`) and built-in helper modules.
        const importerModuleId = importer.moduleIds.findLast(id => path.isAbsolute(id));
        if (importerModuleId) {
          innerMap.set(external, importerModuleId);
        }
      }
    }
  }

  /**
   * Convert moduleResolveMap to a plain object with prototype-less objects
   */
  const usedExternals = Object.create(null) as Record<string, Record<string, string>>;
  for (const [fullPath, innerMap] of moduleResolveMap) {
    const innerObj = Object.create(null) as Record<string, string>;
    for (const [external, value] of innerMap) {
      innerObj[external] = value;
    }
    usedExternals[fullPath] = innerObj;
  }

  /**
   * When externals: true, add the extracted non-workspace deps to usedExternals
   * using a synthetic entry path to track them.
   */
  if (extractedExternals.size > 0) {
    const syntheticPath = path.join(workspaceRoot || projectRoot, '__externals__');
    const externalsObj = Object.create(null) as Record<string, string>;
    for (const [dep, rootPath] of extractedExternals) {
      externalsObj[dep] = rootPath;
    }
    usedExternals[syntheticPath] = externalsObj;
  }

  return { output, fileNameToDependencyMap, usedExternals, requiredExternals };
}
