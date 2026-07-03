import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

interface PackageJson {
  version?: string;
  peerDependencies?: Record<string, string>;
}

export interface ResolvedPackageInfo {
  version?: string;
  packageJson?: PackageJson;
}

function findPackageJsonPath(packageName: string, rootDir: string): string | undefined {
  const requireFromRoot = createRequire(join(rootDir, 'package.json'));

  let entryPath: string;
  try {
    entryPath = requireFromRoot.resolve(packageName);
  } catch {
    return undefined;
  }

  let currentDir = dirname(entryPath);
  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = join(currentDir, 'package.json');
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string };
      if (packageJson.name === packageName) {
        return packageJsonPath;
      }
    } catch {}

    currentDir = dirname(currentDir);
  }

  return undefined;
}

export function getPackageInfo(packageName: string, rootDir: string): ResolvedPackageInfo | undefined {
  const packageJsonPath = findPackageJsonPath(packageName, rootDir);
  if (!packageJsonPath) {
    return undefined;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
  return {
    version: packageJson.version,
    packageJson,
  };
}
