import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ErrorCategory, ErrorDomain, MastraError } from '@internal/core/error';
import { resolveModule } from 'local-pkg';
import * as resolveExports from 'resolve.exports';
import type { Plugin } from 'rolldown';
import { exactRegex } from 'rolldown/filter';
import { getPackageInfo } from '../package-info';
import { getPackageName, isBareModuleSpecifier } from '../utils';
import type { BundlerPlatform } from '../utils';

// resolve.exports always adds `default` and `import`; `browser: true` swaps its `node` condition for `browser`.
function getExportsOptions(platform: BundlerPlatform): resolveExports.Options {
  if (platform === 'browser') {
    return { browser: true, conditions: ['browser', 'worker', 'default'] };
  }
  return { browser: false, conditions: ['node'] };
}

async function resolveBareTarget(id: string, resolveFrom: string, platform: BundlerPlatform) {
  const packageName = getPackageName(id);
  if (!packageName) return undefined;

  const resolutionBase = pathToFileURL(`${dirname(resolveFrom)}${sep}`).href;
  const packageInfo = await getPackageInfo(packageName, { paths: [resolutionBase] });
  if (packageInfo?.packageJson.exports) {
    try {
      const [entry] = resolveExports.exports(packageInfo.packageJson, id, getExportsOptions(platform)) ?? [];
      if (entry) return resolve(packageInfo.rootPath, entry);
    } catch {
      return undefined;
    }
  }

  return resolveModule(id, { paths: [resolutionBase] });
}

function isVirtualId(id: string) {
  return id.startsWith('\0') || id.startsWith('#');
}

export function moduleAlias(
  alias: Record<string, string>,
  resolveFrom: string,
  platform: BundlerPlatform = 'node',
): Plugin | null {
  const keys = Object.keys(alias);
  if (keys.length === 0) {
    return null;
  }

  return {
    name: 'module-alias',
    resolveId: {
      order: 'pre',
      filter: { id: keys.map(key => exactRegex(key)) },
      async handler(id, importer, { kind, custom }) {
        if (!Object.hasOwn(alias, id)) return null;
        const target = alias[id]!;

        const resolveImporter = importer && !isVirtualId(importer) ? importer : resolveFrom;
        const resolvedBareTarget = isBareModuleSpecifier(target)
          ? await resolveBareTarget(target, resolveImporter, platform)
          : undefined;
        if (resolvedBareTarget) return resolvedBareTarget;

        const resolved = await this.resolve(target, resolveImporter, { kind, custom, skipSelf: true });
        if (resolved) return resolved;

        throw new MastraError({
          id: 'DEPLOYER_ALIAS_TARGET_NOT_FOUND',
          domain: ErrorDomain.DEPLOYER,
          category: ErrorCategory.USER,
          details: {
            alias: id,
            target,
          },
          text: `Could not resolve deployer alias \`${id}\` to \`${target}\`.`,
        });
      },
    },
  };
}
