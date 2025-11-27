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

export function isDependencyPartOfPackage(dep: string, packageName: string) {
  if (dep === packageName) {
    return true;
  }

  return dep.startsWith(`${packageName}/`);
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
    let options: { paths?: string[] } | undefined = undefined;
    if (parentPath) {
      if (!parentPath.startsWith('file://')) {
        parentPath = pathToFileURL(parentPath).href;
      }

      options = {
        paths: [parentPath],
      };
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

/**
 * Native binding loaders and infrastructure packages that should be ignored when identifying the actual package that requires native bindings
 */
const NATIVE_BINDING_LOADERS = [
  'node-gyp-build',
  'prebuild-install',
  'bindings',
  'node-addon-api',
  'node-pre-gyp',
  'nan', // Native Abstractions for Node.js
] as const;

/**
 * Finds the first real package from node_modules that likely contains native bindings, filtering out virtual modules and native binding loader infrastructure.
 *
 * @param moduleIds - Array of module IDs from a Rollup chunk
 * @returns The module ID of the actual native package, or undefined if not found
 *
 * @example
 * const moduleIds = [
 *   '\x00/path/node_modules/bcrypt/bcrypt.js?commonjs-module',
 *   '/path/node_modules/node-gyp-build/index.js',
 *   '/path/node_modules/bcrypt/bcrypt.js',
 * ];
 * findNativePackageModule(moduleIds); // Returns '/path/node_modules/bcrypt/bcrypt.js'
 */
export function findNativePackageModule(moduleIds: string[]): string | undefined {
  return moduleIds.find(id => {
    // Skip virtual modules (Rollup plugin-generated)
    if (id.startsWith('\x00')) {
      return false;
    }

    // Must be from node_modules
    if (!id.includes('/node_modules/')) {
      return false;
    }

    // Skip native binding loader infrastructure
    for (const loader of NATIVE_BINDING_LOADERS) {
      if (id.includes(`/${loader}/`) || id.includes(`/${loader}@`)) {
        return false;
      }
    }

    return true;
  });
}
