import fs from 'fs';
import path from 'path';
import { rootDir } from '../config.js';

export interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: any;
}

export function getPackageJson(packagePath: string): PackageJson | null {
  const fullPath = path.join(rootDir, packagePath, 'package.json');
  if (fs.existsSync(fullPath)) {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  }
  return null;
}
