import { readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { getPackageInfoSync } from 'local-pkg';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface MastraPackageInfo {
  name: string;
  version: string;
}

function getResolvedVersion(packageName: string, specifiedVersion: string, rootDir: string): string {
  try {
    // Pass the node_modules path to ensure local-pkg starts resolution from
    // the user's project's node_modules directory
    const nodeModulesPath = join(rootDir, 'node_modules');
    const packageInfo = getPackageInfoSync(packageName, { paths: [nodeModulesPath] });

    if (packageInfo?.version) {
      // Verify the resolved package is actually from the user's project,
      // not from a parent directory (e.g., the CLI's own dependencies)
      const resolvedPath = normalize(packageInfo.rootPath);
      const expectedPrefix = normalize(rootDir);

      if (resolvedPath.startsWith(expectedPrefix)) {
        return packageInfo.version;
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: read directly from the user's node_modules
  try {
    const packageJsonPath = join(rootDir, 'node_modules', packageName, 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    return packageJson.version ?? specifiedVersion;
  } catch {
    // Fall back to the specified version from package.json
    return specifiedVersion;
  }
}

export function getMastraPackages(rootDir: string): MastraPackageInfo[] {
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

    const packages = mastraDeps.map(([name, specifiedVersion]) => ({
      name,
      version: getResolvedVersion(name, specifiedVersion, rootDir),
    }));

    return packages;
  } catch {
    return [];
  }
}
