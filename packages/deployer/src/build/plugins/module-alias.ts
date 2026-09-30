import { pathToFileURL } from 'node:url';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import rollupAlias from '@rollup/plugin-alias';
import { resolveModule } from 'local-pkg';
import type { Plugin, ResolveIdHook } from 'rollup';
import { isBareModuleSpecifier } from '../utils';

function exactMatch(specifier: string) {
  return new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

export function moduleAlias(alias: Record<string, string>, resolveFrom: string): Plugin | null {
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
        const resolved = await this.resolve(id, resolveImporter, options);
        const resolvedBareTarget =
          isBareModuleSpecifier(id) && (!resolved || resolved.external)
            ? resolveModule(id, { paths: [pathToFileURL(resolveImporter).href] })
            : undefined;

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
