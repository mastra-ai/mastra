/**
 * Note: This function depends on local-pkg and should only be used at build-time.
 * It is in a separate file to avoid including local-pkg in runtime code.
 */

import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readJSON } from 'fs-extra/esm';
import { getPackageInfo } from 'local-pkg';
import { getPackageName } from './utils';

const moduleRequire = createRequire(import.meta.url);

async function findPackageRootPath(resolvedPath: string, packageName: string): Promise<string | null> {
  let currentDir = dirname(resolvedPath);

  while (currentDir !== dirname(currentDir)) {
    try {
      const pkgJson = await readJSON(join(currentDir, 'package.json'));
      if (!packageName || pkgJson.name === packageName) {
        return currentDir;
      }
    } catch {
      // Keep walking up until we find the package boundary.
    }

    currentDir = dirname(currentDir);
  }

  return null;
}

async function resolvePackageRootPath(packageName: string, parentPath?: string): Promise<string | null> {
  try {
    const requestedPackageName = getPackageName(packageName);
    const resolveBasePath = parentPath ? getResolveBasePath(parentPath) : null;
    if (resolveBasePath && !existsSync(resolveBasePath)) {
      return null;
    }

    const resolver = resolveBasePath
      ? createRequire(pathToFileURL(join(resolveBasePath, '__mastra_resolve__.js')))
      : moduleRequire;
    const resolvedPath = resolver.resolve(packageName);

    return findPackageRootPath(resolvedPath, requestedPackageName ?? packageName);
  } catch {
    return null;
  }
}

function getResolveBasePath(parentPath: string): string {
  const filePath = parentPath.startsWith('file://') ? fileURLToPath(parentPath) : parentPath;

  try {
    return statSync(filePath).isDirectory() ? filePath : dirname(filePath);
  } catch {
    return dirname(filePath);
  }
}

/**
 * Get package root path
 */
export async function getPackageRootPath(packageName: string, parentPath?: string): Promise<string | null> {
  let rootPath = await resolvePackageRootPath(packageName, parentPath);
  if (rootPath) {
    return rootPath;
  }

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
