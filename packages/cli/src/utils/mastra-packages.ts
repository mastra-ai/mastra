import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getPackageInfo } from './package-info.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface MastraPackageInfo {
  name: string;
  version: string;
}

async function getResolvedVersion(packageName: string, specifiedVersion: string, rootDir: string): Promise<string> {
  try {
    const packageInfo = getPackageInfo(packageName, rootDir);
    return packageInfo?.version ?? specifiedVersion;
  } catch {
    // Fall back to the specified version if we can't resolve the installed version
    return specifiedVersion;
  }
}

export async function getMastraPackages(rootDir: string): Promise<MastraPackageInfo[]> {
  try {
    const packageJsonPath = join(rootDir, 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);

    const allDependencies = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };

    const mastraDeps = Object.entries(allDependencies).filter(
      ([name]) => name.startsWith('@mastra/') || name === 'mastra',
    );

    const packages = await Promise.all(
      mastraDeps.map(async ([name, specifiedVersion]) => ({
        name,
        version: await getResolvedVersion(name, specifiedVersion, rootDir),
      })),
    );

    return packages;
  } catch {
    return [];
  }
}
