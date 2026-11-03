import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Plugin } from 'rolldown';
import { ResolverFactory } from 'rolldown/experimental';
import type { PackageJson } from 'type-fest';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { BARE_SPECIFIER_FILTER } from '../rolldown/filters';
import type { BundlerPlatform } from '../utils';
import { getPackageName, isBareModuleSpecifier, slash } from '../utils';

export const UNRESOLVED_WORKSPACE_IMPORT = 'UNRESOLVED_WORKSPACE_IMPORT';

export type NodeModulesExternalsOptions = {
  platform: BundlerPlatform;
  workspaceMap: Map<string, WorkspacePackageInfo>;
  /** Called when a workspace package import reaches this plugin (nothing upstream resolved it). It is still externalized. */
  onWorkspaceImport?: (id: string, importer: string) => void;
};

function createResolver(platform: BundlerPlatform) {
  const isBrowser = platform === 'browser';

  // Mirrors the defaults of `@rollup/plugin-node-resolve`, which decided the extension before.
  return new ResolverFactory({
    conditionNames: isBrowser ? ['browser', 'worker', 'import', 'module', 'default'] : ['node', 'import', 'default'],
    mainFields: isBrowser ? ['browser', 'module', 'main'] : ['module', 'main'],
    extensions: ['.mjs', '.js', '.json', '.node'],
    symlinks: false,
  });
}

/**
 * Externalizes every bare import that no earlier plugin resolved, like Rollup did for unresolved imports.
 *
 * Subpath imports of packages without an `exports` field (e.g. `lodash/fp/get`) are rewritten to the file Node would
 * need at runtime (`lodash/fp/get.js`), because Node's ESM loader doesn't add extensions. Packages with `exports` keep
 * the specifier as written.
 */
export function nodeModulesExternals({
  platform,
  workspaceMap,
  onWorkspaceImport,
}: NodeModulesExternalsOptions): Plugin {
  let resolver: ResolverFactory | undefined;
  const hasExportsCache = new Map<string, Promise<boolean>>();

  function packageHasExports(pkgRoot: string) {
    let cached = hasExportsCache.get(pkgRoot);
    if (!cached) {
      cached = readFile(`${pkgRoot}/package.json`, 'utf-8').then(content =>
        Boolean((JSON.parse(content) as PackageJson).exports),
      );
      hasExportsCache.set(pkgRoot, cached);
    }
    return cached;
  }

  async function resolveSubpath(id: string, pkgName: string, importer: string): Promise<string> {
    resolver ??= createResolver(platform);
    const { path } = await resolver.async(dirname(importer), id);
    if (!path) {
      return id;
    }

    // The nearest package.json can be a nested one (e.g. `pkg/sub/package.json`), so the root is found by name.
    const resolvedPath = slash(path);
    const marker = `/node_modules/${pkgName}/`;
    const markerIndex = resolvedPath.lastIndexOf(marker);
    if (markerIndex === -1) {
      return id;
    }

    const pkgRoot = resolvedPath.slice(0, markerIndex + marker.length - 1);
    if (await packageHasExports(pkgRoot)) {
      return id;
    }

    return pkgName + resolvedPath.slice(pkgRoot.length);
  }

  return {
    name: 'node-modules-externals',
    buildStart() {
      // Watch mode reuses the plugin, and installs between rebuilds can change what resolves.
      resolver?.clearCache();
      hasExportsCache.clear();
    },
    resolveId: {
      order: 'post',
      filter: { id: BARE_SPECIFIER_FILTER },
      async handler(id, importer, { isEntry }) {
        if (isEntry || !importer || importer.startsWith('\0') || !isBareModuleSpecifier(id)) {
          return null;
        }

        const pkgName = getPackageName(id);
        if (!pkgName) {
          return null;
        }

        if (workspaceMap.has(pkgName)) {
          if (onWorkspaceImport) {
            onWorkspaceImport(id, importer);
          } else {
            // Surfaces like Rollup's UNRESOLVED_IMPORT warning did, so the bundler can fail on leaked workspace imports.
            this.warn({
              message: `Workspace import "${id}" was not resolved`,
              pluginCode: UNRESOLVED_WORKSPACE_IMPORT,
              exporter: id,
              id: importer,
            });
          }
          return { id, external: true };
        }

        if (id === pkgName) {
          return { id, external: true };
        }

        try {
          return { id: await resolveSubpath(id, pkgName, importer), external: true };
        } catch {
          return { id, external: true };
        }
      },
    },
  };
}
