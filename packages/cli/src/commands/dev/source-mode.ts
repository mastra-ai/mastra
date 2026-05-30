import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'tinyglobby';

const SOURCE_MODE_CONDITION = '--conditions=mastra-source';

function isRepoSourceModeRequested() {
  return ['1', 'true'].includes(process.env.MASTRA_SOURCE_MODE ?? '');
}

function withSourceModeCondition(nodeOptions?: string) {
  if (nodeOptions?.split(/\s+/).includes(SOURCE_MODE_CONDITION)) {
    return nodeOptions;
  }

  return [nodeOptions, SOURCE_MODE_CONDITION].filter(Boolean).join(' ');
}

function packageRootFromCurrentModule() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return dirname(dirname(dirname(currentDir)));
}

function isMastraRepoWorkspaceRoot(workspaceRoot: string) {
  return (
    existsSync(join(workspaceRoot, 'pnpm-workspace.yaml')) &&
    existsSync(join(workspaceRoot, 'packages', 'cli', 'src', 'index.ts')) &&
    existsSync(join(workspaceRoot, 'packages', 'core', 'src'))
  );
}

function getSourceModeWorkspaceRoot() {
  const explicitWorkspaceRoot = process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT;
  if (explicitWorkspaceRoot && isMastraRepoWorkspaceRoot(explicitWorkspaceRoot)) {
    return explicitWorkspaceRoot;
  }

  const packageRoot = packageRootFromCurrentModule();
  const workspaceRoot = dirname(dirname(packageRoot));
  if (existsSync(join(packageRoot, 'src', 'index.ts')) && isMastraRepoWorkspaceRoot(workspaceRoot)) {
    return workspaceRoot;
  }

  return undefined;
}

export function isSourceModeEnabled() {
  return isRepoSourceModeRequested() && getSourceModeWorkspaceRoot() !== undefined;
}

export function applySourceModeEnv(env?: Map<string, string>) {
  const workspaceRoot = getSourceModeWorkspaceRoot();
  if (!workspaceRoot) {
    return;
  }

  const nodeOptions = withSourceModeCondition(env?.get('NODE_OPTIONS') ?? process.env.NODE_OPTIONS);

  process.env.MASTRA_SOURCE_MODE = '1';
  process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT = workspaceRoot;
  process.env.NODE_OPTIONS = nodeOptions;
  env?.set('MASTRA_SOURCE_MODE', '1');
  env?.set('MASTRA_SOURCE_MODE_WORKSPACE_ROOT', workspaceRoot);
  env?.set('NODE_OPTIONS', nodeOptions);
}

function isPathInside(parent: string, child: string) {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function packageJsonPatternsFromWorkspace(workspaceYaml: string) {
  const patterns: string[] = [];
  let inPackages = false;

  for (const line of workspaceYaml.split('\n')) {
    if (line === 'packages:') {
      inPackages = true;
      continue;
    }

    if (inPackages && line.length > 0 && !line.startsWith(' ')) {
      break;
    }

    const match = line.match(/^\s+-\s+(.+)$/);
    if (!inPackages || !match?.[1]) continue;

    const pattern = match[1].replace(/^["']|["']$/g, '');
    patterns.push(pattern.endsWith('/package.json') ? pattern : `${pattern}/package.json`);
  }

  return patterns;
}

async function sourceModeWorkspacePackageJsonPaths(workspaceRoot: string) {
  const workspaceYamlPath = join(workspaceRoot, 'pnpm-workspace.yaml');
  if (!existsSync(workspaceYamlPath)) return [];

  return glob(packageJsonPatternsFromWorkspace(await readFile(workspaceYamlPath, 'utf-8')), {
    cwd: workspaceRoot,
    absolute: true,
    onlyFiles: true,
  });
}

export async function linkSourceModeWorkspacePackages(outputDir: string) {
  if (!isSourceModeEnabled()) {
    return;
  }

  const workspaceRoot = getSourceModeWorkspaceRoot();
  if (!workspaceRoot) {
    return;
  }

  const nodeModulesDir = join(outputDir, 'node_modules');
  await mkdir(nodeModulesDir, { recursive: true });

  const realOutputDir = await realpath(outputDir).catch(() => resolve(outputDir));

  const linkNodeModules = async (sourceNodeModules: string) => {
    if (!existsSync(sourceNodeModules)) {
      return;
    }

    const realSourceNodeModules = await realpath(sourceNodeModules).catch(() => resolve(sourceNodeModules));
    if (realSourceNodeModules === realOutputDir || isPathInside(realOutputDir, realSourceNodeModules)) {
      return;
    }

    const canLinkDependency = async (sourcePath: string) => {
      const realSourcePath = await realpath(sourcePath).catch(() => resolve(sourcePath));
      return realSourcePath !== realOutputDir && !isPathInside(realOutputDir, realSourcePath);
    };

    for (const entry of await readdir(sourceNodeModules, { withFileTypes: true })) {
      if (entry.name === '.bin' || entry.name === '@mastra') {
        continue;
      }

      const sourcePath = join(sourceNodeModules, entry.name);
      if (!(await canLinkDependency(sourcePath))) {
        continue;
      }

      if (entry.name.startsWith('@')) {
        const scopeDir = join(nodeModulesDir, entry.name);
        await mkdir(scopeDir, { recursive: true });
        for (const scopedEntry of await readdir(sourcePath, { withFileTypes: true })) {
          const scopedSourcePath = join(sourcePath, scopedEntry.name);
          if (!(await canLinkDependency(scopedSourcePath))) {
            continue;
          }

          const linkPath = join(scopeDir, scopedEntry.name);
          if (existsSync(linkPath)) {
            continue;
          }
          await symlink(scopedSourcePath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
        }
        continue;
      }

      const linkPath = join(nodeModulesDir, entry.name);
      if (!existsSync(linkPath)) {
        await symlink(sourcePath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
      }
    }
  };

  await linkNodeModules(join(workspaceRoot, 'node_modules'));

  for (const packageJsonPath of await sourceModeWorkspacePackageJsonPaths(workspaceRoot)) {
    const packageDir = dirname(packageJsonPath);
    await linkNodeModules(join(packageDir, 'node_modules'));

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as { name?: string };
    const packageJsonName = packageJson.name;
    if (!packageJsonName || (!packageJsonName.startsWith('@mastra/') && packageJsonName !== 'mastra')) {
      continue;
    }

    const packageNameParts = packageJsonName.split('/');
    const scopeOrName = packageNameParts[0]!;
    const packageName = packageNameParts[1];
    const linkDir = packageName ? join(nodeModulesDir, scopeOrName) : nodeModulesDir;
    const linkPath = packageName ? join(linkDir, packageName) : join(linkDir, scopeOrName);
    await mkdir(linkDir, { recursive: true });
    await rm(linkPath, { recursive: true, force: true });
    await symlink(packageDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  }
}
