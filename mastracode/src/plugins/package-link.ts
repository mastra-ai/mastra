import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MASTRACODE_PACKAGE_ROOT = findMastraCodePackageRoot(path.dirname(fileURLToPath(import.meta.url)));

export function findMastraCodePackageRoot(startDir: string): string {
  let currentDir = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string };
      if (packageJson.name === 'mastracode') {
        return currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Could not find mastracode package root from ${startDir}`);
    }
    currentDir = parentDir;
  }
}

export function ensureMastraCodePackageLink(pluginDir: string): void {
  if (declaresInstallableMastraCodeDependency(pluginDir)) {
    return;
  }

  const nodeModulesDir = path.join(pluginDir, 'node_modules');
  const linkPath = path.join(nodeModulesDir, 'mastracode');
  try {
    if (fs.realpathSync(linkPath) === fs.realpathSync(MASTRACODE_PACKAGE_ROOT)) {
      return;
    }
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  fs.mkdirSync(nodeModulesDir, { recursive: true });
  fs.symlinkSync(MASTRACODE_PACKAGE_ROOT, linkPath, 'dir');
}

function declaresInstallableMastraCodeDependency(pluginDir: string): boolean {
  const packageJsonPath = path.join(pluginDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return false;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, unknown>;
    devDependencies?: Record<string, unknown>;
    optionalDependencies?: Record<string, unknown>;
  };

  return Boolean(
    packageJson.dependencies?.mastracode ??
    packageJson.devDependencies?.mastracode ??
    packageJson.optionalDependencies?.mastracode,
  );
}
