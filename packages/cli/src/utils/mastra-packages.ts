import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { getPackageInfo } from 'local-pkg';

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
    const nodeModulesPath = join(rootDir, 'node_modules');
    const packageInfo = await getPackageInfo(packageName, { paths: [nodeModulesPath] });

    // Verify resolved package is from the user's project, not CLI's dependencies
    if (packageInfo?.version && normalize(packageInfo.rootPath).startsWith(normalize(rootDir))) {
      return packageInfo.version;
    }

    // Fallback: read directly from user's node_modules
    const content = await readFile(join(rootDir, 'node_modules', packageName, 'package.json'), 'utf-8');
    return JSON.parse(content).version ?? specifiedVersion;
  } catch {
    return specifiedVersion;
  }
}

export async function getMastraPackages(rootDir: string): Promise<MastraPackageInfo[]> {
  try {
    const packageJsonPath = join(rootDir, 'package.json');
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
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
