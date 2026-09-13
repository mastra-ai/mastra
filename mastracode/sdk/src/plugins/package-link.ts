import fs from 'node:fs';
import { createRequire } from 'node:module';
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

function resolvedPackageRoot(entryPath: string, packageName: string): string | undefined {
  let resolved: string;
  try {
    resolved = createRequire(entryPath).resolve(`${packageName}/package.json`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return undefined;
    throw error;
  }
  let dir = path.dirname(fs.realpathSync(resolved));
  while (true) {
    if (readPackageName(dir) === packageName) return fs.realpathSync(dir);
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Could not find package root for ${packageName} at ${resolved}`);
    dir = parent;
  }
}

/** Reject nested runtime copies before importing any plugin code or opening its storage. */
export function assertHostPluginRuntime(entryPath: string): void {
  for (const name of ['mastracode', '@mastra/code-sdk']) {
    const pluginRoot = resolvedPackageRoot(entryPath, name);
    if (!pluginRoot) continue;
    let hostRoot: string | undefined;
    if (name === 'mastracode') {
      try {
        hostRoot = fs.realpathSync(mastraCodePackageRoot());
      } catch {
        // SDK-only consumers need not install the CLI runtime.
        hostRoot = undefined;
      }
    } else {
      hostRoot = resolvedPackageRoot(fileURLToPath(import.meta.url), name);
    }
    if (pluginRoot !== hostRoot) {
      throw new Error(
        `Plugin runtime mismatch: ${name} resolves to ${pluginRoot}, but the host uses ${hostRoot ?? 'no CLI runtime'}. ` +
          'Plugin code was not loaded. Remove the plugin-local runtime copy and use the host runtime ' +
          '(declare a peer dependency and reinstall/relink the plugin), then restart Mastra Code. Do not reset storage.',
      );
    }
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
