import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPackageInfo } from 'local-pkg';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface MastraPackageInfo {
  name: string;
  version: string;
}

async function getResolvedVersion(packageName: string, specifiedVersion: string): Promise<string> {
  try {
    const packageInfo = await getPackageInfo(packageName);
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
      ...(packageJson.optionalDependencies ?? {}),
    };

    const mastraDeps = Object.entries(allDependencies).filter(
      ([name]) => name.startsWith('@mastra/') || name === 'mastra',
    );

    const packages = await Promise.all(
      mastraDeps.map(async ([name, specifiedVersion]) => ({
        name,
        version: await getResolvedVersion(name, specifiedVersion),
      })),
    );

    return packages;
  } catch {
    return [];
  }
}

/** File name of the packages manifest, shared by `mastra dev` and `mastra build`. */
export const MASTRA_PACKAGES_FILE_NAME = 'mastra-packages.json';

/**
 * Writes the resolved Mastra package versions next to the built server, so a
 * deployed server can report what it runs without access to the project's
 * package.json or node_modules.
 */
export async function writeMastraPackagesManifest(outputDir: string, packages: MastraPackageInfo[]): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, MASTRA_PACKAGES_FILE_NAME), JSON.stringify(packages, null, 2));
}
