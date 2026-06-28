import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MASTRACODE_PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function ensureMastraCodePackageLink(pluginDir: string): void {
  const nodeModulesDir = path.join(pluginDir, 'node_modules');
  const linkPath = path.join(nodeModulesDir, 'mastracode');
  if (fs.existsSync(linkPath)) return;

  fs.mkdirSync(nodeModulesDir, { recursive: true });
  fs.symlinkSync(MASTRACODE_PACKAGE_ROOT, linkPath, 'dir');
}
