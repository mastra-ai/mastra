import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PackageManager } from '../types';

/**
 * Lock files and their corresponding package managers.
 */
const LOCK_FILES: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun',
  'package-lock.json': 'npm',
};

/**
 * Install command flags by package manager.
 */
const INSTALL_FLAGS: Record<PackageManager, string[]> = {
  npm: ['install', '--audit=false', '--fund=false', '--loglevel=error', '--progress=false'],
  pnpm: ['install', '--ignore-workspace', '--loglevel=error'],
  yarn: ['install', '--silent'],
  bun: ['install', '--silent'],
};

/**
 * Build command (run scripts.build) by package manager.
 */
const BUILD_COMMANDS: Record<PackageManager, string[]> = {
  npm: ['run', 'build'],
  pnpm: ['run', 'build'],
  yarn: ['run', 'build'],
  bun: ['run', 'build'],
};

/**
 * Detect package manager from lock files or package.json.
 */
export async function detectPackageManager(projectPath: string): Promise<PackageManager> {
  // Check for lock files
  for (const [lockFile, manager] of Object.entries(LOCK_FILES)) {
    const lockPath = path.join(projectPath, lockFile);
    try {
      await fs.access(lockPath);
      return manager;
    } catch {
      // Lock file doesn't exist, continue
    }
  }

  // Check packageManager field in package.json
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as { packageManager?: string };

    if (packageJson.packageManager) {
      const pmField = packageJson.packageManager;
      if (pmField.startsWith('pnpm')) return 'pnpm';
      if (pmField.startsWith('yarn')) return 'yarn';
      if (pmField.startsWith('bun')) return 'bun';
      if (pmField.startsWith('npm')) return 'npm';
    }
  } catch {
    // No package.json or parse error
  }

  // Default to npm
  return 'npm';
}

/**
 * Get install command arguments for a package manager.
 */
export function getInstallArgs(pm: PackageManager): string[] {
  return INSTALL_FLAGS[pm] ?? INSTALL_FLAGS.npm;
}

/**
 * Get build command arguments for a package manager.
 */
export function getBuildArgs(pm: PackageManager): string[] {
  return BUILD_COMMANDS[pm] ?? BUILD_COMMANDS.npm;
}

/**
 * Check if a build script exists in package.json.
 */
export async function hasBuildScript(projectPath: string): Promise<boolean> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as { scripts?: { build?: string } };
    return !!packageJson.scripts?.build;
  } catch {
    return false;
  }
}
