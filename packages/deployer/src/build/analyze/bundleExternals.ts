import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import virtual from '@rollup/plugin-virtual';
import esmShim from '@rollup/plugin-esm-shim';
import { basename } from 'node:path/posix';
import * as path from 'node:path';
import { rollup, type OutputChunk, type OutputAsset, type Plugin } from 'rollup';
import { esbuild } from '../plugins/esbuild';
import { aliasHono } from '../plugins/hono-alias';
import { getCompiledDepCachePath, getPackageRootPath, rollupSafeName, slash } from '../utils';
import { type WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import type { DependencyMetadata } from '../types';
import { DEPS_TO_IGNORE, GLOBAL_EXTERNALS, DEPRECATED_EXTERNALS } from './constants';
import * as resolve from 'resolve.exports';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import { readFile } from 'node:fs/promises';
import { getPackageInfo } from 'local-pkg';
import { ErrorCategory, ErrorDomain, MastraBaseError } from '@mastra/core/error';

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
  }: { workspaceRoot: string | null; projectRoot: string; outputDir: string; bundlerOptions?: { isDev?: boolean } },
): {
  optimizedDependencyEntries: Map<string, VirtualDependency>;
  fileNameToDependencyMap: Map<string, string>;
} {
  const { isDev = false } = bundlerOptions || {};
  const fileNameToDependencyMap = new Map<string, string>();
  const optimizedDependencyEntries = new Map<string, VirtualDependency>();
  const rootDir = workspaceRoot || projectRoot;

  for (const [dep, { exports }] of depsToOptimize.entries()) {
    const fileName = dep.replaceAll('/', '-');
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
  if (isDev) {
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
 * Configures and returns Rollup plugins for bundling external dependencies.
 * Sets up virtual modules, TypeScript compilation, CommonJS transformation, and workspace resolution.
 */
async function getInputPlugins(
  virtualDependencies: Map<string, { name: string; virtual: string }>,
  {
    transpilePackages,
    workspaceMap,
    bundlerOptions,
    rootDir,
  }: {
    transpilePackages: Set<string>;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    bundlerOptions: { enableEsmShim: boolean; isDev: boolean };
    rootDir: string;
  },
) {
  const transpilePackagesMap = new Map<string, string>();
  for (const pkg of transpilePackages) {
    const dir = await getPackageRootPath(pkg);

    if (dir) {
      transpilePackagesMap.set(pkg, slash(dir));
    } else {
      transpilePackagesMap.set(pkg, workspaceMap.get(pkg)?.location ?? pkg);
    }
  }

  return [
    virtual(
      Array.from(virtualDependencies.entries()).reduce(
        (acc, [dep, virtualDep]) => {
          acc[`#virtual-${dep}`] = virtualDep.virtual;
          return acc;
        },
        {} as Record<string, string>,
      ),
    ),
    transpilePackagesMap.size
      ? esbuild({
          format: 'esm',
          include: [...transpilePackagesMap.values()].map(p => {
            // Match files from transpilePackages but exclude any nested node_modules
            // Escapes regex special characters in the path and uses negative lookahead to avoid node_modules
            // generated by cursor
            if (path.isAbsolute(p)) {
              return new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?!.*node_modules).*$`);
            } else {
              return new RegExp(`\/${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?!.*node_modules).*$`);
            }
          }),
        })
      : null,
    bundlerOptions.isDev
      ? ({
          name: 'alias-optimized-deps',
          async resolveId(id, importer, options) {
            if (!virtualDependencies.has(id)) {
              return null;
            }

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

            return await this.resolve(path.posix.join(packageRootPath, resolvedPath!), importer, options);
          },
        } satisfies Plugin)
      : null,
    optimizeLodashImports({
      include: '**/*.{js,ts,mjs,cjs}',
    }),
    commonjs({
      strictRequires: 'strict',
      transformMixedEsModules: true,
      ignoreTryCatch: false,
    }),
    bundlerOptions.isDev
      ? null
      : nodeResolve({
          preferBuiltins: true,
          exportConditions: ['node'],
        }),
    bundlerOptions.isDev ? esmShim() : null,
    // hono is imported from deployer, so we need to resolve from here instead of the project root
    aliasHono(),
    json(),
    {
      name: 'not-found-resolver',
      resolveId: {
        order: 'post',
        async handler(id, importer) {
          if (!importer) {
            return null;
          }

          if (!id.endsWith('.node')) {
            return null;
          }

          const pkgInfo = await getPackageInfo(importer);
          const packageName = pkgInfo?.packageJson?.name || id;
          throw new MastraBaseError({
            id: 'DEPLOYER_BUNDLE_EXTERNALS_MISSING_NATIVE_BUILD',
            domain: ErrorDomain.DEPLOYER,
            category: ErrorCategory.USER,
            details: {
              importFile: importer,
              packageName,
            },
            text: `We found a possible binary dependency in your bundle. ${id} was not found when imported at ${importer}.
            
Please consider adding \`${packageName}\` to your externals, or updating this import to not end with ".node".
  
export const mastra = new Mastra({
  bundler: {
    externals: ["${packageName}"],
  }
})`,
          });
        },
      },
    } satisfies Plugin,
  ].filter(Boolean);
}

/**
 * Executes the Rollup build process for virtual dependencies using configured plugins.
 * Bundles all virtual dependency modules into optimized ESM files with proper external handling.
 */
async function buildExternalDependencies(
  virtualDependencies: Map<string, VirtualDependency>,
  {
    externals,
    packagesToTranspile,
    workspaceMap,
    rootDir,
    outputDir,
    bundlerOptions,
  }: {
    externals: string[];
    packagesToTranspile: Set<string>;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    rootDir: string;
    outputDir: string;
    bundlerOptions: {
      enableEsmShim: boolean;
      isDev: boolean;
    };
  },
) {
  /**
   * If there are no virtual dependencies to bundle, return an empty array to avoid Rollup errors.
   */
  if (virtualDependencies.size === 0) {
    return [] as unknown as [OutputChunk, ...(OutputAsset | OutputChunk)[]];
  }

  const bundler = await rollup({
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    input: Array.from(virtualDependencies.entries()).reduce(
      (acc, [dep, virtualDep]) => {
        acc[virtualDep.name] = `#virtual-${dep}`;
        return acc;
      },
      {} as Record<string, string>,
    ),
    external: externals,
    treeshake: 'safest',
    plugins: getInputPlugins(virtualDependencies, {
      transpilePackages: packagesToTranspile,
      workspaceMap,
      bundlerOptions,
      rootDir,
    }),
  });

  const outputDirRelative = prepareEntryFileName(outputDir, rootDir);

  const { output } = await bundler.write({
    format: 'esm',
    dir: rootDir,
    entryFileNames: '[name].mjs',
    /**
     * Rollup creates chunks for common dependencies, but these chunks are by default written to the root directory instead of respecting the entryFileNames structure.
     * So we want to write them to the `.mastra/output` folder as well.
     */
    chunkFileNames: chunkInfo => {
      /**
       * This whole bunch of logic directly below is for the edge case shown in the e2e-tests/monorepo with "tinyrainbow" package. It's used in multiple places in the package and as such Rollup creates a shared chunk for it. During 'mastra dev', we don't want that chunk to show up in the '.mastra/output' folder (outputDirRelative) but inside <pkg>/node_modules/.cache instead.
       * We only care about this during 'mastra dev'!
       */
      if (bundlerOptions.isDev) {
        const importedFromPackages = new Set<string>();

        for (const moduleId of chunkInfo.moduleIds) {
          const normalized = slash(moduleId);
          for (const [pkgName, pkgInfo] of workspaceMap.entries()) {
            const location = slash(pkgInfo.location);
            if (normalized.startsWith(location)) {
              importedFromPackages.add(pkgName);
              break;
            }
          }
        }

        if (importedFromPackages.size > 1) {
          throw new MastraBaseError({
            id: 'DEPLOYER_BUNDLE_EXTERNALS_SHARED_CHUNK',
            domain: ErrorDomain.DEPLOYER,
            category: ErrorCategory.USER,
            details: {
              chunkName: chunkInfo.name,
              packages: JSON.stringify(Array.from(importedFromPackages)),
            },
            text: `Please open an issue. We found a shared chunk "${chunkInfo.name}" used by multiple workspace packages: ${Array.from(importedFromPackages).join(', ')}.`,
          });
        }

        if (importedFromPackages.size === 1) {
          const [pkgName] = importedFromPackages;
          const workspaceLocation = workspaceMap.get(pkgName!)!.location;
          return prepareEntryFileName(getCompiledDepCachePath(workspaceLocation, '[name].mjs'), rootDir);
        }
      }

      return `${outputDirRelative}/[name].mjs`;
    },
    hoistTransitiveImports: false,
  });

  await bundler.close();

  return output;
}

/**
 * Recursively searches through Rollup output chunks to find which module imports a specific external dependency.
 * Used to build the module resolution map for proper external dependency tracking.
 */
function findExternalImporter(module: OutputChunk, external: string, allOutputs: OutputChunk[]): OutputChunk | null {
  const capturedFiles = new Set();

  for (const id of module.imports) {
    if (id === external) {
      return module;
    } else {
      if (id.endsWith('.mjs')) {
        capturedFiles.add(id);
      }
    }
  }

  for (const file of capturedFiles) {
    const nextModule = allOutputs.find(o => o.fileName === file);
    if (nextModule) {
      const importer = findExternalImporter(nextModule, external, allOutputs);

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
    bundlerOptions?: {
      externals?: string[];
      transpilePackages?: string[];
      isDev?: boolean;
      enableEsmShim?: boolean;
    } | null;
    projectRoot?: string;
    workspaceRoot?: string;
    workspaceMap?: Map<string, WorkspacePackageInfo>;
  },
) {
  const { workspaceRoot = null, workspaceMap = new Map(), projectRoot = outputDir, bundlerOptions = {} } = options;
  const {
    externals: customExternals = [],
    transpilePackages = [],
    isDev = false,
    enableEsmShim = true,
  } = bundlerOptions || {};
  const allExternals = [...GLOBAL_EXTERNALS, ...DEPRECATED_EXTERNALS, ...customExternals];

  const workspacePackagesNames = Array.from(workspaceMap.keys());
  const packagesToTranspile = new Set([...transpilePackages, ...workspacePackagesNames]);

  const { optimizedDependencyEntries, fileNameToDependencyMap } = createVirtualDependencies(depsToOptimize, {
    workspaceRoot,
    outputDir,
    projectRoot,
    bundlerOptions: {
      isDev,
    },
  });

  const output = await buildExternalDependencies(optimizedDependencyEntries, {
    externals: allExternals,
    packagesToTranspile,
    workspaceMap,
    rootDir: workspaceRoot || projectRoot,
    outputDir,
    bundlerOptions: {
      enableEsmShim,
      isDev,
    },
  });

  const moduleResolveMap = new Map<string, Map<string, string>>();
  const filteredChunks = output.filter(o => o.type === 'chunk');

  for (const o of filteredChunks.filter(o => o.isEntry || o.isDynamicEntry)) {
    for (const external of allExternals) {
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

        if (importer.moduleIds.length) {
          innerMap.set(
            external,
            importer.moduleIds[importer.moduleIds.length - 1]?.startsWith('\x00virtual:#virtual')
              ? importer.moduleIds[importer.moduleIds.length - 2]!
              : importer.moduleIds[importer.moduleIds.length - 1]!,
          );
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

  return { output, fileNameToDependencyMap, usedExternals };
}
