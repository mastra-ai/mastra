/**
 * Note: This function is meant to be used at build-time only.
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSON } from 'fs-extra/esm';
import { getPackageName } from './utils';

/**
 * Walk up from a resolved entry file to the nearest enclosing directory that contains a
 * `package.json` — that directory is the package root. We match on existence rather than on the
 * `package.json` `name` so that npm alias installs (e.g. `"ai-v5": "npm:ai@5"`, where the specifier
 * differs from the installed package's real name) resolve correctly. A deep entry such as
 * `dist/index.js` has no `package.json` in its subdirectories, so the first one found walking up is
 * always the true package root.
 */
function findPackageRoot(entryPath: string): string | null {
  let dir = dirname(entryPath);

  while (true) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Get package root path
 */
export async function getPackageRootPath(packageName: string, parentPath?: string): Promise<string | null> {
  try {
    // Anchor resolution at `parentPath` (a notional file inside it) so Node resolves the package
    // from `parentPath`'s node_modules upward — the same way the bundled code would.
    //
    // We resolve the package's main entry (its "." export) with Node's own resolver and then derive
    // the root directory from it, rather than reading `<pkg>/package.json` through module resolution.
    // Packages whose `exports` map omits `./package.json` (e.g. execa 9) make that subpath lookup
    // throw for the correct copy, which silently falls through to a stale copy hoisted elsewhere in
    // the workspace — so the wrong version gets pinned in the build output. See issue #18849.
    let anchor: string;
    if (parentPath) {
      const parentDir = parentPath.startsWith('file://') ? fileURLToPath(parentPath) : parentPath;
      anchor = join(parentDir, 'noop.js');
    } else {
      anchor = join(process.cwd(), 'noop.js');
    }

    const require = createRequire(anchor);
    let entryPath: string;
    try {
      entryPath = require.resolve(packageName);
    } catch {
      return null;
    }

    return findPackageRoot(entryPath);
  } catch {
    return null;
  }
}

async function readPackageMetadata(
  rootPath: string,
  requestedPackageName: string | null,
): Promise<{ rootPath: string; version?: string; packageSpec?: string }> {
  try {
    const pkgJson = await readJSON(`${rootPath}/package.json`);
    const version = pkgJson.version;
    const actualPackageName = pkgJson.name;
    const packageSpec =
      version && actualPackageName && requestedPackageName && requestedPackageName !== actualPackageName
        ? `npm:${actualPackageName}@${version}`
        : undefined;

    return { rootPath, version, packageSpec };
  } catch {
    return { rootPath };
  }
}

export async function getPackageMetadata(
  packageName: string,
  parentPath?: string,
): Promise<{ rootPath: string | null; version?: string; packageSpec?: string }> {
  const requestedPackageName = getPackageName(packageName);
  const packageNames = [...new Set([packageName, requestedPackageName].filter(Boolean) as string[])];
  let firstRootPath: string | null = null;

  for (const name of packageNames) {
    const rootPath = await getPackageRootPath(name, parentPath);
    firstRootPath ??= rootPath;
    if (!rootPath) {
      continue;
    }

    const metadata = await readPackageMetadata(rootPath, requestedPackageName ?? null);
    if (metadata.version || metadata.packageSpec) {
      return metadata;
    }
  }

  return { rootPath: firstRootPath };
}
