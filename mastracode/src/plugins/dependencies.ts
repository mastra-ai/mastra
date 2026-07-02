import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

import { NON_INTERACTIVE_GIT_ENV } from './process-env.js';

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

type InstallCommand = {
  command: PackageManager;
  args: string[];
};

export async function reconcilePluginDependencies(pluginDir: string): Promise<void> {
  const command = resolvePluginDependencyInstallCommand(pluginDir);
  if (!command) return;

  await execa(command.command, command.args, { cwd: pluginDir, env: NON_INTERACTIVE_GIT_ENV });
}

function resolvePluginDependencyInstallCommand(pluginDir: string): InstallCommand | undefined {
  const packageJsonPath = path.join(pluginDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return undefined;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { packageManager?: unknown };
  const manager =
    parsePackageManager(packageJson.packageManager) ?? detectPackageManagerFromLockfiles(pluginDir) ?? 'npm';

  return buildInstallCommand(manager, pluginDir);
}

function parsePackageManager(value: unknown): PackageManager | undefined {
  if (typeof value !== 'string') return undefined;
  const [name] = value.split('@');
  return isSupportedPackageManager(name) ? name : undefined;
}

function detectPackageManagerFromLockfiles(pluginDir: string): PackageManager | undefined {
  if (fs.existsSync(path.join(pluginDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (
    fs.existsSync(path.join(pluginDir, 'package-lock.json')) ||
    fs.existsSync(path.join(pluginDir, 'npm-shrinkwrap.json'))
  ) {
    return 'npm';
  }
  if (fs.existsSync(path.join(pluginDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(pluginDir, 'bun.lock')) || fs.existsSync(path.join(pluginDir, 'bun.lockb'))) return 'bun';
  return undefined;
}

function buildInstallCommand(manager: PackageManager, pluginDir: string): InstallCommand {
  switch (manager) {
    case 'pnpm':
      return {
        command: 'pnpm',
        args: hasLockfile(pluginDir, ['pnpm-lock.yaml']) ? ['install', '--frozen-lockfile'] : ['install'],
      };
    case 'npm':
      return {
        command: 'npm',
        args: hasLockfile(pluginDir, ['package-lock.json', 'npm-shrinkwrap.json']) ? ['ci'] : ['install'],
      };
    case 'yarn':
      return {
        command: 'yarn',
        args: hasLockfile(pluginDir, ['yarn.lock']) ? ['install', '--frozen-lockfile'] : ['install'],
      };
    case 'bun':
      return {
        command: 'bun',
        args: hasLockfile(pluginDir, ['bun.lock', 'bun.lockb']) ? ['install', '--frozen-lockfile'] : ['install'],
      };
  }
}

function hasLockfile(pluginDir: string, names: string[]): boolean {
  return names.some(name => fs.existsSync(path.join(pluginDir, name)));
}

function isSupportedPackageManager(value: string | undefined): value is PackageManager {
  return value === 'pnpm' || value === 'npm' || value === 'yarn' || value === 'bun';
}
