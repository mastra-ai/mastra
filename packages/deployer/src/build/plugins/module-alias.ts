import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import rollupAlias from '@rollup/plugin-alias';
import { resolveModule } from 'local-pkg';
import * as resolveExports from 'resolve.exports';
import type { Plugin, ResolveIdHook } from 'rollup';
import { getPackageInfo } from '../package-info';
import { getNodeResolveOptions, getPackageName, isBareModuleSpecifier } from '../utils';
import type { BundlerPlatform } from '../utils';

function exactMatch(specifier: string) {
  return new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

async function resolveBareTarget(id: string, resolveFrom: string, platform: BundlerPlatform) {
  const packageName = getPackageName(id);
  if (!packageName) return undefined;

  const resolutionBase = pathToFileURL(`${dirname(resolveFrom)}${sep}`).href;
  const packageInfo = await getPackageInfo(packageName, { paths: [resolutionBase] });
  if (packageInfo?.packageJson.exports) {
    const nodeResolveOptions = getNodeResolveOptions(platform);
    try {
      const [entry] =
        resolveExports.exports(packageInfo.packageJson, id, {
          browser: nodeResolveOptions.browser === true,
          conditions: nodeResolveOptions.exportConditions,
        }) ?? [];
      if (entry) return resolve(packageInfo.rootPath, entry);
    } catch {
      return undefined;
    }
  }

  return resolveModule(id, { paths: [resolutionBase] });
}

export function moduleAlias(
  alias: Record<string, string>,
  resolveFrom: string,
  platform: BundlerPlatform = 'node',
): Plugin | null {
  const entries = Object.entries(alias);
  if (entries.length === 0) {
    return null;
  }

  const plugin = rollupAlias({
    entries: entries.map(([specifier, target]) => ({
      find: exactMatch(specifier),
      replacement: target,
      customResolver: async function (id, importer, options) {
        const resolveImporter = importer && !importer.startsWith('\0') ? importer : resolveFrom;
        const resolvedBareTarget = isBareModuleSpecifier(id)
          ? await resolveBareTarget(id, resolveImporter, platform)
          : undefined;
        const resolved = resolvedBareTarget ? undefined : await this.resolve(id, resolveImporter, options);

        if (!resolvedBareTarget && !resolved) {
          throw new MastraError({
            id: 'DEPLOYER_ALIAS_TARGET_NOT_FOUND',
            domain: ErrorDomain.DEPLOYER,
            category: ErrorCategory.USER,
            details: {
              alias: specifier,
              target,
            },
            text: `Could not resolve deployer alias \`${specifier}\` to \`${target}\`.`,
          });
        }

        return resolvedBareTarget ?? resolved;
      },
    })),
  });

  return {
    ...plugin,
    name: 'module-alias',
    resolveId: {
      order: 'pre',
      handler: plugin.resolveId as ResolveIdHook,
    },
  };
}
