import fs from 'fs';
import path from 'path';
import type { PackageJson } from './getPackageJson.js';

export function updatePackageJson(packagePath: string, packageJson: PackageJson): void {
  const fullPath = path.join(packagePath, 'package.json');

  fs.writeFileSync(fullPath, JSON.stringify(packageJson, null, 2) + '\n');
}
