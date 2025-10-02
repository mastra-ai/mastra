import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { basename, join, relative } from 'path';
import { getPackageInfo as getPackageInfoLocal, type PackageInfo } from 'local-pkg';
import { pathToFileURL } from 'url';
import { readJSON } from 'fs-extra/esm';

export function upsertMastraDir({ dir = process.cwd() }: { dir?: string }) {
  const dirPath = join(dir, '.mastra');

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    execSync(`echo ".mastra" >> .gitignore`);
  }
}

/**
 * Get the package name from a module ID
 */
export function getPackageName(id: string) {
  const parts = id.split('/');

  if (id.startsWith('@')) {
    return parts.slice(0, 2).join('/');
  }

  return parts[0];
}

/**
 * Get package root path
 */
export async function getPackageInfo(packageName: string, parentPath?: string): Promise<PackageInfo | undefined> {
  let pkg: PackageInfo | undefined;
  let options: { paths?: string[] } | undefined = undefined;

  // Create paths option if parentPath is provided
  if (parentPath) {
    if (!parentPath.startsWith('file://')) {
      parentPath = pathToFileURL(parentPath).href;
    }

    options = {
      paths: [parentPath],
    };
  }

  // Get package info
  pkg = (await getPackageInfoLocal(packageName, options)) as PackageInfo | undefined;

  //Extra logic for packageInfo resolution
  if (pkg && pkg.rootPath && !pkg?.version) {
    const realRootPath = pkg.rootPath.includes(pkg.name)
      ? pkg.rootPath.slice(0, pkg.rootPath.lastIndexOf(pkg.name) + pkg.name.length)
      : undefined;
    if (realRootPath) {
      try {
        const realPackageJson = await readJSON(join(realRootPath, 'package.json'));
        const realPkg = {
          ...pkg,
          version: realPackageJson.version,
        };
        pkg = realPkg as PackageInfo | undefined;
      } catch (e) {
        pkg = pkg as PackageInfo | undefined;
      }
    }
  }

  return pkg;
}

/**
 * During `mastra dev` we are compiling TS files to JS (inside workspaces) so that users can just their workspace packages.
 * We store these compiled files inside `node_modules/.cache` for each workspace package.
 */
export function getCompiledDepCachePath(rootPath: string, packageName: string) {
  return slash(join(rootPath, 'node_modules', '.cache', packageName));
}

/**
 * Convert windows backslashes to posix slashes
 *
 * @example
 * ```ts
 * slash('C:\\Users\\user\\code\\mastra') // 'C:/Users/user/code/mastra'
 * ```
 */
export function slash(path: string) {
  const isExtendedLengthPath = path.startsWith('\\\\?\\');

  if (isExtendedLengthPath) {
    return path;
  }

  return path.replaceAll('\\', '/');
}

/**
 * Make a Rollup-safe name: pathless, POSIX, and without parent/absolute segments
 */
export function rollupSafeName(name: string, rootDir: string) {
  const rel = relative(rootDir, name);
  let entry = slash(rel);
  entry = entry.replace(/^(\.\.\/)+/, '');
  entry = entry.replace(/^\/+/, '');
  entry = entry.replace(/^[A-Za-z]:\//, '');
  if (!entry) {
    entry = slash(basename(name));
  }
  return entry;
}
