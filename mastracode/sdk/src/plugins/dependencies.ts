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
  const installCommand = getInstallCommand(pluginRoot, packageJson.packageManager ?? commandPackageJson.packageManager);

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
        `This plugin uses ${installCommand.command}, but ${installCommand.command} is not installed. Install ${installCommand.command} and try again. Plugin path: ${pluginRoot}`,
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

function getInstallCommand(pluginRoot: string, packageManager: unknown): InstallCommand {
  if (typeof packageManager !== 'string' || !/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
    throw new Error(
      `Plugin at ${pluginRoot} must declare an exact pnpm version in package.json using "packageManager": "pnpm@x.y.z".`,
    );
  }

  return hasFile(pluginRoot, 'pnpm-lock.yaml')
    ? installCommand('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile'])
    : installCommand('pnpm', ['install', '--ignore-workspace']);
}

function installCommand(command: string, args: string[]): InstallCommand {
  return { command, args: [...args, '--ignore-scripts'] };
}

function isCommandNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

function readPackageJson(pluginRoot: string): { packageManager?: unknown } {
  const packageJsonPath = path.join(pluginRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return {};
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { packageManager?: unknown };
}

function hasFile(pluginRoot: string, fileName: string): boolean {
  return fs.existsSync(path.join(pluginRoot, fileName));
}
