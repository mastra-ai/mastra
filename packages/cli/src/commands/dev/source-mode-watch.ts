import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as fsExtra from 'fs-extra';
import { glob } from 'tinyglobby';

import type { MastraPackageInfo } from '../../utils/mastra-packages.js';

export function isSourceModeRuntimeEnabled() {
  return process.env.MASTRA_SOURCE_MODE === '1';
}

const SOURCE_MODE_WATCH_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

function shouldWatchSourceFile(fileName: string) {
  if (fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('.mock.')) return false;
  return [...SOURCE_MODE_WATCH_EXTENSIONS].some(extension => fileName.endsWith(extension));
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  if (!(await fsExtra.pathExists(directory))) return [];

  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && shouldWatchSourceFile(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
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

async function sourceModeWorkspacePackages() {
  const workspaceRoot = process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT;
  if (!isSourceModeRuntimeEnabled() || !workspaceRoot)
    return new Map<string, { root: string; dependencies: string[] }>();

  const workspaceYamlPath = join(workspaceRoot, 'pnpm-workspace.yaml');
  if (!(await fsExtra.pathExists(workspaceYamlPath)))
    return new Map<string, { root: string; dependencies: string[] }>();

  const packageJsonPaths = await glob(packageJsonPatternsFromWorkspace(await readFile(workspaceYamlPath, 'utf-8')), {
    cwd: workspaceRoot,
    absolute: true,
    onlyFiles: true,
  });

  const packages = new Map<string, { root: string; dependencies: string[] }>();
  for (const packageJsonPath of packageJsonPaths) {
    const packageRoot = dirname(packageJsonPath);
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    if (!packageJson.name) continue;

    const dependencies = Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    }).filter(name => name === 'mastra' || name.startsWith('@mastra/') || name.startsWith('@internal/'));

    packages.set(packageJson.name, { root: packageRoot, dependencies });
  }

  return packages;
}

async function sourceModeWatchFiles(mastraPackages: MastraPackageInfo[] = []) {
  const workspacePackages = await sourceModeWorkspacePackages();
  if (workspacePackages.size === 0 || mastraPackages.length === 0) return [];

  const selected = new Set<string>();
  const queue = mastraPackages.map(({ name }) => name);
  while (queue.length > 0) {
    const packageName = queue.shift()!;
    if (selected.has(packageName)) continue;
    const packageInfo = workspacePackages.get(packageName);
    if (!packageInfo) continue;

    selected.add(packageName);
    queue.push(...packageInfo.dependencies);
  }

  const files = await Promise.all(
    [...selected].map(packageName => collectSourceFiles(join(workspacePackages.get(packageName)!.root, 'src'))),
  );

  return [...new Set(files.flat())];
}

export async function sourceModeWatcherPlugin(mastraPackages: MastraPackageInfo[] = []) {
  if (!isSourceModeRuntimeEnabled()) return [];

  const sourceWatchFiles = await sourceModeWatchFiles(mastraPackages);
  if (sourceWatchFiles.length === 0) return [];

  return [
    {
      name: 'mastra-source-mode-package-watcher',
      buildStart(this: { addWatchFile(file: string): void }) {
        for (const file of sourceWatchFiles) {
          this.addWatchFile(file);
        }
      },
    },
  ];
}
