import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import virtual from '@rollup/plugin-virtual';
import esmShim from '@rollup/plugin-esm-shim';
import { basename } from 'node:path/posix';
import * as path from 'node:path';
import { rollup, type OutputChunk, type OutputAsset } from 'rollup';
import { esbuild } from '../plugins/esbuild';
import { aliasHono } from '../plugins/hono-alias';
import { getCompiledDepCachePath, getPackageRootPath } from '../utils';
import { type WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import type { DependencyMetadata } from '../types';
import { DEPS_TO_IGNORE, GLOBAL_EXTERNALS, DEPRECATED_EXTERNALS } from './constants';

type VirtualDependency = {
  name: string;
  virtual: string;
};

function prepareEntryFileName(name: string, rootDir: string) {
  /**
   * The Rollup output.entryFileNames option doesn't allow relative (like `../../foo`) or absolute paths
   * Since the current working directory is the project root, the resulting path won't have any `..` segments
   */
  const relativePath = path.relative(rootDir, name);

  return (
    relativePath
      /**
       * Use posix separators (/) for entry names, as Rollup expects that
       */
      .replaceAll(path.sep, path.posix.sep)
  );
}

/**
 * Creates virtual dependency modules for optimized bundling by generating virtual entry points for each dependency with their specific exports and handling workspace package path resolution.
 */
export function createVirtualDependencies(
  depsToOptimize: Map<string, DependencyMetadata>,
  { projectRoot, workspaceRoot, outputDir }: { workspaceRoot: string | null; projectRoot: string; outputDir: string },
): {
  optimizedDependencyEntries: Map<string, VirtualDependency>;
  fileNameToDependencyMap: Map<string, string>;
} {
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

  return { optimizedDependencyEntries, fileNameToDependencyMap };
}

/**
 * Configures and returns Rollup plugins for bundling external dependencies.
 * Sets up virtual modules, TypeScript compilation, CommonJS transformation, and workspace resolution.
 */
async function getInputPlugins(
  virtualDependencies: Map<string, { virtual: string }>,
  transpilePackages: Set<string>,
  workspaceMap: Map<string, WorkspacePackageInfo>,
  bundlerOptions: {
    enableEsmShim: boolean;
  },
) {
  const transpilePackagesMap = new Map<string, string>();
  for (const pkg of transpilePackages) {
    const dir = await getPackageRootPath(pkg);

    if (dir) {
      transpilePackagesMap.set(pkg, dir);
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
            return new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?!.*node_modules).*$`);
          }),
        })
      : null,
    commonjs({
      strictRequires: 'strict',
      transformMixedEsModules: true,
      ignoreTryCatch: false,
    }),
    bundlerOptions.enableEsmShim ? esmShim() : undefined,
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
      // Do not embed external dependencies into files that we write to `node_modules/.cache` (for the mastra dev + workspace use case)
      ...(workspaceMap.size > 0 ? { resolveOnly: Array.from(workspaceMap.keys()) } : {}),
    }),
    // hono is imported from deployer, so we need to resolve from here instead of the project root
    aliasHono(),
    json(),
  ];
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
    treeshake: 'smallest',
    plugins: getInputPlugins(virtualDependencies, packagesToTranspile, workspaceMap, bundlerOptions),
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
    chunkFileNames: `${outputDirRelative}/[name].mjs`,
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
  });

  const output = await buildExternalDependencies(optimizedDependencyEntries, {
    externals: allExternals,
    packagesToTranspile,
    workspaceMap: isDev ? workspaceMap : new Map(),
    rootDir: workspaceRoot || projectRoot,
    outputDir,
    bundlerOptions: {
      enableEsmShim,
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
