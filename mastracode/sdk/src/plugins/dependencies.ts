import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

const NON_INTERACTIVE_INSTALL_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

type InstallCommand = {
  command: string;
  args: string[];
};

export type PluginInstallExecutionOptions = {
  onOutput?: (chunk: Buffer | string) => void;
  signal?: AbortSignal;
};

export async function installPluginDependencies(
  pluginRoot: string,
  commandRoot = pluginRoot,
  options: PluginInstallExecutionOptions = {},
): Promise<boolean> {
  const packageJsonPath = path.join(pluginRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = readPackageJson(pluginRoot);
  const commandPackageJson = commandRoot === pluginRoot ? packageJson : readPackageJson(commandRoot);
  const packageManager = Object.hasOwn(packageJson, 'packageManager')
    ? packageJson.packageManager
    : commandPackageJson.packageManager;
  const pnpmVersion = getPnpmVersion(pluginRoot, packageManager);
  const installCommand = getInstallCommand(pluginRoot, pnpmVersion);

  const child = execa(installCommand.command, installCommand.args, {
    cwd: pluginRoot,
    env: NON_INTERACTIVE_INSTALL_ENV,
    stdout: options.onOutput ? 'pipe' : 'ignore',
    stderr: options.onOutput ? 'pipe' : 'ignore',
    cancelSignal: options.signal,
  });
  if (options.onOutput) {
    child.stdout?.on('data', options.onOutput);
    child.stderr?.on('data', options.onOutput);
  }
  try {
    await child;
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      throw new Error(
        'Mastra Code requires Corepack to install GitHub plugin dependencies. Install it with "npm install --global corepack" and try again.',
        { cause: error },
      );
    }
    throw error;
  }
  return true;
}

export async function installPluginDependenciesForEntry(
  pluginRoot: string,
  entry: string,
  options: PluginInstallExecutionOptions = {},
): Promise<void> {
  for (const dependencyRoot of getPluginDependencyRoots(pluginRoot, entry)) {
    await installPluginDependencies(dependencyRoot, pluginRoot, options);
  }
}

export function getPluginDependencyRoots(pluginRoot: string, entry: string): string[] {
  const roots = fs.existsSync(path.join(pluginRoot, 'package.json')) ? [pluginRoot] : [];
  const entryPackageRoot = findEntryPackageRoot(pluginRoot, entry);
  if (entryPackageRoot && entryPackageRoot !== pluginRoot) {
    roots.push(entryPackageRoot);
  }
  return roots;
}

export function getEntryPackageRoot(pluginRoot: string, entry: string): string {
  return findEntryPackageRoot(pluginRoot, entry) ?? pluginRoot;
}

function findEntryPackageRoot(pluginRoot: string, entry: string): string | undefined {
  const root = path.resolve(pluginRoot);
  let current = path.dirname(path.resolve(pluginRoot, entry));

  while (isInsideDirectory(current, root)) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    if (current === root) break;
    current = path.dirname(current);
  }

  return undefined;
}

function isInsideDirectory(targetPath: string, root: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(root);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

function getPnpmVersion(pluginRoot: string, packageManager: unknown): string {
  if (typeof packageManager !== 'string') {
    throw new Error(
      `Plugin at ${pluginRoot} must declare an exact pnpm version in package.json using "packageManager": "pnpm@x.y.z".`,
    );
  }

  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageManager);
  if (!match?.[1]) {
    throw new Error(
      `Plugin at ${pluginRoot} must declare an exact pnpm version in package.json using "packageManager": "pnpm@x.y.z".`,
    );
  }
  return match[1];
}

function getInstallCommand(pluginRoot: string, pnpmVersion: string): InstallCommand {
  const installArgs = ['install', '--ignore-workspace'];
  if (hasFile(pluginRoot, 'pnpm-lock.yaml')) installArgs.push('--frozen-lockfile');
  installArgs.push('--ignore-scripts');

  return {
    command: 'corepack',
    args: [`pnpm@${pnpmVersion}`, ...installArgs],
  };
}

function isCommandNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function readPackageJson(pluginRoot: string): { packageManager?: unknown } {
  const packageJsonPath = path.join(pluginRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return {};
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { packageManager?: unknown };
}

function hasFile(pluginRoot: string, fileName: string): boolean {
  return fs.existsSync(path.join(pluginRoot, fileName));
}
