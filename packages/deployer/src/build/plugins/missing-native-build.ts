import { ErrorCategory, ErrorDomain, MastraBaseError } from '@internal/core/error';
import type { Plugin } from 'rolldown';
import { getPackageInfo } from '../package-info';

/**
 * Turns an unresolvable `*.node` import into an actionable error that suggests adding the package to externals.
 */
export function missingNativeBuildResolver(): Plugin {
  return {
    name: 'not-found-resolver',
    resolveId: {
      // Rolldown's native resolver runs after every JS resolveId hook, so resolve explicitly and only throw when the
      // binary really is missing.
      order: 'post',
      filter: { id: /\.node$/ },
      async handler(id, importer, opts) {
        if (!importer) {
          return null;
        }

        const resolved = await this.resolve(id, importer, { ...opts, skipSelf: true });
        if (resolved) {
          return resolved;
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
  } satisfies Plugin;
}
