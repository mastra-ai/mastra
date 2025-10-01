import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { basename, join, relative } from 'path';
import { getPackageInfo } from 'local-pkg';
import { pathToFileURL } from 'url';

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
export async function getPackageRootPath(packageName: string, parentPath?: string): Promise<string | null> {
  let rootPath: string | null;

  try {
    const options: { paths?: string[] } = {};
    if (parentPath) {
      if (!parentPath.startsWith('file://')) {
        parentPath = pathToFileURL(parentPath).href;
      }

      options.paths = [parentPath];
    }
    const pkg = await getPackageInfo(packageName, options);
    rootPath = pkg?.rootPath ?? null;
  } catch (e) {
    rootPath = null;
  }

  return rootPath;
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
