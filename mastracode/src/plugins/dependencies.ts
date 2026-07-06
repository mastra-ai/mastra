import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

const NON_INTERACTIVE_INSTALL_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

type InstallCommand = {
  command: string;
  args: string[];
};

export async function installPluginDependencies(pluginRoot: string): Promise<boolean> {
  const packageJsonPath = path.join(pluginRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { packageManager?: unknown };
  const installCommand = getInstallCommand(
    pluginRoot,
    typeof packageJson.packageManager === 'string' ? packageJson.packageManager : undefined,
  );

  await execa(installCommand.command, installCommand.args, {
    cwd: pluginRoot,
    env: NON_INTERACTIVE_INSTALL_ENV,
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return true;
}

function getInstallCommand(pluginRoot: string, packageManager?: string): InstallCommand {
  if (packageManager?.startsWith('pnpm@')) {
    return { command: 'pnpm', args: ['install', '--frozen-lockfile'] };
  }

  if (packageManager?.startsWith('npm@')) {
    return hasNpmLockfile(pluginRoot) ? { command: 'npm', args: ['ci'] } : { command: 'npm', args: ['install'] };
  }

  if (packageManager?.startsWith('yarn@')) {
    return { command: 'yarn', args: ['install', '--frozen-lockfile'] };
  }

  if (packageManager?.startsWith('bun@')) {
    return { command: 'bun', args: ['install', '--frozen-lockfile'] };
  }

  if (hasFile(pluginRoot, 'pnpm-lock.yaml')) {
    return { command: 'pnpm', args: ['install', '--frozen-lockfile'] };
  }

  if (hasNpmLockfile(pluginRoot)) {
    return { command: 'npm', args: ['ci'] };
  }

  if (hasFile(pluginRoot, 'yarn.lock')) {
    return { command: 'yarn', args: ['install', '--frozen-lockfile'] };
  }

  if (hasFile(pluginRoot, 'bun.lock') || hasFile(pluginRoot, 'bun.lockb')) {
    return { command: 'bun', args: ['install', '--frozen-lockfile'] };
  }

  return { command: 'npm', args: ['install'] };
}

function hasNpmLockfile(pluginRoot: string): boolean {
  return hasFile(pluginRoot, 'package-lock.json') || hasFile(pluginRoot, 'npm-shrinkwrap.json');
}

function hasFile(pluginRoot: string, fileName: string): boolean {
  return fs.existsSync(path.join(pluginRoot, fileName));
}
