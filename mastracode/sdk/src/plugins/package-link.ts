import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

let cachedPackageRoot: string | undefined;

// This module ships in @mastra/code-sdk, so the `mastracode` package root is
// resolved lazily: from the module location (source tree / bundled dist), or —
// for the published CLI where the sdk is an external dependency — from the
// entry script, which lives inside the `mastracode` package.
function mastraCodePackageRoot(): string {
  if (cachedPackageRoot === undefined) {
    try {
      cachedPackageRoot = findMastraCodePackageRoot(MODULE_DIR);
    } catch (error) {
      const entryScript = process.argv[1];
      if (!entryScript) throw error;
      cachedPackageRoot = findMastraCodePackageRoot(path.dirname(fs.realpathSync(entryScript)));
    }
  }
  return cachedPackageRoot;
}

function readPackageName(dir: string): string | undefined {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return undefined;
  return (JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string }).name;
}

export function findMastraCodePackageRoot(startDir: string): string {
  let currentDir = path.resolve(startDir);

  while (true) {
    const packageName = readPackageName(currentDir);
    if (packageName === 'mastracode') {
      return currentDir;
    }
    if (packageName === '@mastra/code-sdk') {
      // The `mastracode` package sits next to the sdk: mastracode/sdk ↔
      // mastracode/tui in the source tree, node_modules/@mastra/code-sdk ↔
      // node_modules/mastracode when installed.
      for (const candidate of [
        path.resolve(currentDir, '..', 'tui'),
        path.resolve(currentDir, '..', '..', 'mastracode'),
      ]) {
        if (readPackageName(candidate) === 'mastracode') {
          return candidate;
        }
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

  const packageRoot = mastraCodePackageRoot();
  const nodeModulesDir = path.join(pluginDir, 'node_modules');
  const linkPath = path.join(nodeModulesDir, 'mastracode');
  try {
    if (fs.realpathSync(linkPath) === fs.realpathSync(packageRoot)) {
      return;
    }
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    fs.rmSync(linkPath, { recursive: true, force: true });
  }

  fs.mkdirSync(nodeModulesDir, { recursive: true });
  fs.symlinkSync(packageRoot, linkPath, 'dir');
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
