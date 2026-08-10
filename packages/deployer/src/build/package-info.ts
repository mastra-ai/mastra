/**
 * Note: This function depends on local-pkg and should only be used at build-time.
 * It is in a separate file to avoid including local-pkg in runtime code.
 */

import { realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readJSON } from 'fs-extra/esm';
import { getPackageInfo } from 'local-pkg';
import { getPackageName } from './utils';

/**
 * Normalize a resolution base path to a directory path.
 *
 * Callers often pass a module file path (e.g. a rollup module id like
 * `node_modules/@mastra/core/dist/chunk-XYZ.js`) as the parent path. mlly (used by local-pkg)
 * also treats each resolution base as a directory candidate (`<base>/_index.js`), which makes it
 * try to read `<file>/package.json`. That fails with ENOTDIR, which mlly does not tolerate
 * (only ENOENT) and local-pkg then logs the raw error to the console. Using the file's directory
 * as the base avoids this while resolving identically.
 */
function toParentDirectory(parentPath: string): string {
  // Resolve against the current working directory so that a non-absolute path (a virtual rollup
  // module id for example) cannot make the lookup below return a relative package root.
  const fsPath = resolve(parentPath.startsWith('file://') ? fileURLToPath(parentPath) : parentPath);

  try {
    if (statSync(fsPath).isFile()) {
      return dirname(fsPath);
    }
  } catch {
    // non-existent paths are used as-is
  }

  return fsPath;
}

/**
 * Find the package directory in the closest `node_modules` directory.
 *
 * This is the directory lookup that Node does for a bare import, and the `package.json` in that
 * directory is then read straight from disk.
 *
 * local-pkg instead resolves the `<packageName>/package.json` subpath, which the package's
 * `exports` map can block. A package that does not export `./package.json` (execa 9 for example)
 * is not found that way, and local-pkg can then select a different copy of the package, which
 * pins the wrong version in the built `package.json`.
 *
 * The result is a real path, because `node_modules` entries are symlinks in pnpm and workspace
 * layouts. Callers match this path against rollup module ids, which rollup resolves to real paths.
 */
function findPackageInNodeModules(packageName: string, parentDirectory: string): string | null {
  let directory = parentDirectory;

  while (true) {
    const candidate = join(directory, 'node_modules', ...packageName.split('/'));
    try {
      if (statSync(join(candidate, 'package.json')).isFile()) {
        return realpathSync(candidate);
      }
    } catch {
      // keep looking in the parent directory
    }

    const parent = dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

/**
 * Get package root path
 */
export async function getPackageRootPath(packageName: string, parentPath?: string): Promise<string | null> {
  const parentDirectory = parentPath ? toParentDirectory(parentPath) : process.cwd();

  const rootPath = findPackageInNodeModules(packageName, parentDirectory);
  if (rootPath) {
    return rootPath;
  }

  // fallback for layouts without a `node_modules` directory, for example a linked workspace package
  try {
    const pkg = await getPackageInfo(packageName, { paths: [pathToFileURL(parentDirectory).href] });
    return pkg?.rootPath ?? null;
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
