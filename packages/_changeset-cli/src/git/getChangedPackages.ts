import path from 'path';
import { getChangedPackagesSinceRef } from '@changesets/git';
import { rootDir } from '../config.js';
import { getPublicPackages } from '../pkg/getPublicPackages.js';

export interface ChangedPackage {
  name: string;
  path: string;
  version: string;
}

export async function getChangedPackages(): Promise<ChangedPackage[]> {
  try {
    const packages = await getPublicPackages();

    let changedPackageDirs;
    try {
      changedPackageDirs = await getChangedPackagesSinceRef({
        cwd: rootDir,
        ref: 'origin/main',
        changedFilePatterns: ['**/*'],
      });
    } catch {
      changedPackageDirs = await getChangedPackagesSinceRef({
        cwd: rootDir,
        ref: 'main',
        changedFilePatterns: ['**/*'],
      });
    }

    const changedPackages: ChangedPackage[] = [];

    for (const { dir } of changedPackageDirs) {
      const pkg = packages.find(pkg => {
        return pkg.dir === dir;
      });

      if (pkg) {
        const relativePath = path.relative(rootDir, pkg.dir);
        changedPackages.push({
          name: pkg.packageJson.name,
          path: relativePath,
          version: pkg.packageJson.version,
        });
      }
    }

    return changedPackages;
  } catch (error) {
    throw new Error('Error detecting changed packages.', { cause: error });
  }
}
