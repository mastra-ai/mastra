/**
 * Note: This function depends on local-pkg and should only be used at build-time.
 * It is in a separate file to avoid including local-pkg in runtime code.
 */

import { realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findUp } from 'find-up-simple';
import { pathExists, readJson, readJSON } from 'fs-extra/esm';
import { getPackageInfo as getOriginalPackageInfo } from 'local-pkg';
import { getPackageName } from './utils';

function isDirectory(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Real path of the package folder Node loads for `packageName` imported from `baseDir`.
 *
 * Copied from `getPackageJSONURL()` in Node.js internals (MIT License, Copyright Node.js contributors):
 * https://github.com/nodejs/node/blob/main/lib/internal/modules/package_json_reader.js
 * Replace with `module.findPackageJSON()` once it is stable and available in every supported Node version. It is
 * experimental (stability 1.1) and missing before Node 22.14.
 *
 * Differs from Node: returns a real path because callers match it against rollup module ids.
 */
async function findInstalledPackageRoot(packageName: string, baseDir: string): Promise<string | undefined> {
  // Self-reference: the nearest package.json, without crossing a node_modules folder, wins when it has exports and
  // the same name.
  for (let dir = baseDir; basename(dir) !== 'node_modules'; dir = dirname(dir)) {
    const packageJsonPath = join(dir, 'package.json');

    if (await pathExists(packageJsonPath)) {
      const packageJson = await readJson(packageJsonPath, { throws: false });

      if (packageJson?.exports != null && packageJson.name === packageName) {
        return realpathSync(dir);
      }

      break;
    }

    if (dirname(dir) === dir) {
      break;
    }
  }

  let dir = baseDir;
  let previousDir: string;

  do {
    const candidate = join(dir, 'node_modules', packageName);

    if (isDirectory(candidate)) {
      return realpathSync(candidate);
    }

    previousDir = dir;
    dir = dirname(dir);
  } while (dir !== previousDir);

  return undefined;
}

export async function getPackageInfo(
  packageName: string,
  options?: { paths?: string[] },
): Promise<ReturnType<typeof getOriginalPackageInfo>> {
  // The nearest manifest above a resolved subpath file can be the subpath folder's own package.json with an
  // unrelated name and version, e.g. read-excel-file/node (#28828).
  const name = getPackageName(packageName);
  if (name && !isAbsolute(packageName) && !packageName.startsWith('.')) {
    const baseDirs = options?.paths?.length ? options.paths.map(path => fileURLToPath(path)) : [process.cwd()];

    for (const baseDir of baseDirs) {
      const rootPath = await findInstalledPackageRoot(name, baseDir);

      if (!rootPath) {
        continue;
      }

      const packageJsonPath = join(rootPath, 'package.json');

      if (await pathExists(packageJsonPath)) {
        const packageJson = await readJson(packageJsonPath);
        return { name: packageJson.name, version: packageJson.version, rootPath, packageJsonPath, packageJson };
      }
    }
  }

  const pkgInfo = await getOriginalPackageInfo(packageName, options);

  // A manifest without a version is still the package root when it is named after the requested package. When a
  // file path is requested there is no package name to compare against, so a named manifest is the root unless an
  // ancestor manifest carries the same name (e.g. engine.io-client/build/esm/package.json inside engine.io-client).
  async function isPackageRoot(pkgJson: { name?: string; version?: string } | undefined, manifestDir: string) {
    if (pkgJson?.version) {
      return true;
    }
    if (!isAbsolute(packageName)) {
      return pkgJson?.name === getPackageName(packageName);
    }
    const name = pkgJson?.name;
    return name ? !(await hasAncestorNamed(name, dirname(manifestDir))) : false;
  }

  async function hasAncestorNamed(name: string, dir: string): Promise<boolean> {
    const path = await findUp('package.json', { cwd: dir });
    if (!path) {
      return false;
    }
    const parentDir = dirname(path);
    if ((await readJson(path)).name === name) {
      return true;
    }
    return parentDir !== dirname(parentDir) && hasAncestorNamed(name, dirname(parentDir));
  }

  async function searchUpForPackageJson(rootPath: string) {
    const path = await findUp('package.json', {
      cwd: rootPath,
    });

    if (!path) {
      return undefined;
    }

    const pkgJson = await readJson(path);

    if (!(await isPackageRoot(pkgJson, dirname(path)))) {
      return searchUpForPackageJson(dirname(rootPath));
    }

    return {
      name: pkgJson.name,
      version: pkgJson.version,
      rootPath: dirname(path),
      packageJsonPath: path,
      packageJson: pkgJson,
    };
  }

  // A nested manifest (e.g. dist/esm/package.json with only "type") is not the package root, so search up for it.
  if (pkgInfo?.rootPath && !(await isPackageRoot(pkgInfo.packageJson, pkgInfo.rootPath))) {
    return searchUpForPackageJson(dirname(pkgInfo.rootPath));
  }

  return pkgInfo;
}

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
function toParentDirectoryUrl(parentPath: string): string {
  let fsPath = resolve(parentPath.startsWith('file://') ? fileURLToPath(parentPath) : parentPath);

  try {
    if (statSync(fsPath).isFile()) {
      fsPath = dirname(fsPath);
    }
  } catch {
    // non-existent paths are used as-is
  }

  // Keep the trailing separator. Without it, URL resolution treats the directory name as a file
  // and starts package lookup from its parent directory.
  return pathToFileURL(`${fsPath}${sep}`).href;
}

/**
 * Get package root path
 */
export async function getPackageRootPath(packageName: string, parentPath?: string): Promise<string | null> {
  let rootPath: string | null;

  try {
    let options: { paths?: string[] } | undefined = undefined;
    if (parentPath) {
      options = {
        paths: [toParentDirectoryUrl(parentPath)],
      };
    }

    const pkg = await getPackageInfo(packageName, options);
    rootPath = pkg?.rootPath ?? null;
  } catch {
    rootPath = null;
  }

  return rootPath;
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
