import * as resolve from 'resolve.exports';
import type { Plugin } from 'rolldown';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { packagesRegex } from '../rolldown/filters';
import { getPackageName, isDependencyPartOfPackage } from '../utils';

/**
 * Externalizes every external and its subpaths (`pkg`, `pkg/...`).
 *
 * Externals whose workspace package declares `exports` need their subpaths validated, so only those go
 * through a JS `resolveId` hook. Everything else is returned as `patterns`, which the caller hands to
 * `external` or `esmExternalRequirePlugin` so Rolldown matches them without calling into JS.
 */
export function subpathExternals(
  externals: string[],
  workspaceMap: Map<string, WorkspacePackageInfo>,
): { patterns: RegExp[]; plugin: Plugin | null } {
  const plain: string[] = [];
  const validated: string[] = [];

  for (const external of externals) {
    // Relative and absolute ids were never matched by this resolver
    if (external.startsWith('.') || external.startsWith('/')) {
      continue;
    }

    const packageName = getPackageName(external);
    if (packageName && workspaceMap.get(packageName)?.exports !== undefined) {
      validated.push(external);
    } else {
      plain.push(external);
    }
  }

  const plainRegex = packagesRegex(plain);
  // Filter on the external entries rather than their package names, so an external `pkg/sub` does not claim `pkg/other`
  const validatedRegex = packagesRegex(validated);

  return {
    patterns: plainRegex ? [plainRegex] : [],
    plugin: validatedRegex
      ? {
          name: 'subpath-externals-resolver',
          resolveId: {
            filter: { id: validatedRegex },
            handler(id) {
              if (!validated.some(external => isDependencyPartOfPackage(id, external))) {
                return null;
              }

              const packageName = getPackageName(id);
              const workspacePackage = packageName ? workspaceMap.get(packageName) : undefined;
              if (packageName && workspacePackage?.exports !== undefined && id !== packageName) {
                const subpath = `.${id.slice(packageName.length)}`;
                try {
                  resolve.exports({ name: packageName, exports: workspacePackage.exports }, subpath);
                } catch {
                  this.error(`Could not resolve workspace package subpath "${id}".`);
                }
              }

              return { id, external: true };
            },
          },
        }
      : null,
  };
}
