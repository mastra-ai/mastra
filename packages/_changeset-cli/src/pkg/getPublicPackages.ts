import { getPackages } from '@manypkg/get-packages';
import type { Package } from '@manypkg/get-packages';
import { rootDir } from '../config.js';

export async function getPublicPackages(): Promise<Package[]> {
  const { packages } = await getPackages(rootDir);
  return packages.filter(pkg => !pkg.packageJson.private);
}
