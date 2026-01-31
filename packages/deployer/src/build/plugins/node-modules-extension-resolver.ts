import { join, isAbsolute } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Plugin } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import { getPackageName, isBuiltinModule } from '../utils';
import { getPackageRootPath } from '../package-info';
import type { PackageJson } from 'type-fest';

/**
 * Check if a package has an exports field in its package.json.
 * Results are cached to avoid repeated filesystem reads.
 */
async function getPackageJSON(pkgName: string, importer: string): Promise<PackageJson> {
  const pkgRoot = await getPackageRootPath(pkgName, importer);
  if (!pkgRoot) {
    throw new Error(`Package ${pkgName} not found`);
  }

  const pkgJSON = JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf-8')) as PackageJson;
  return pkgJSON;
}

/**
 * Rollup plugin that resolves module extensions for external dependencies.
 *
 * This plugin handles ESM compatibility for external imports when node-resolve is not used:
 * - Packages WITH exports field (e.g., hono, date-fns): Keep imports as-is or strip redundant extensions
 * - Packages WITHOUT exports field (e.g., lodash): Add .js extension for direct file imports
 */
export function nodeModulesExtensionResolver(): Plugin {
  // Create a single instance of node-resolve to reuse
  const nodeResolvePlugin = nodeResolve();

  return {
    name: 'node-modules-extension-resolver',
    async resolveId(id, importer, options) {
      // Skip relative imports, absolute paths, no importer, or builtin modules
      if (!importer || id.startsWith('.') || id.startsWith('/') || isBuiltinModule(id) || isAbsolute(id)) {
        return null;
      }

      // Skip direct package imports (e.g., 'lodash', '@mastra/core')
      const parts = id.split('/');
      const isScoped = id.startsWith('@');
      if ((isScoped && parts.length === 2) || (!isScoped && parts.length === 1)) {
        return null;
      }

      const pkgName = getPackageName(id);
      if (!pkgName) {
        return null;
      }

      try {
        const packageJSON = await getPackageJSON(pkgName, importer);
        // if it has exports, node should be able to rsolve it, if not the exports map is wrong.
        if (!!packageJSON.exports) {
          return null;
        }

        const packageRoot = await getPackageRootPath(pkgName, importer);
        // @ts-expect-error - handle is part of resolveId signature
        const nodeResolved = await nodeResolvePlugin.resolveId?.handler?.call(this, id, importer, options);
        // if we cannot resolve it, it's not a valid import so we let node handle it
        if (!nodeResolved?.id) {
          return null;
        }

        let filePath = nodeResolved.id;
        if (nodeResolved.resolvedBy === 'commonjs--resolver') {
          filePath = filePath.substring(1).split('?')[0];
        }

        const resolvedImportPath = filePath.replace(packageRoot, pkgName);

        return {
          id: resolvedImportPath,
          external: true,
        };
      } catch (err) {
        console.error(err);
        return null;
      }
    },
  };
}
