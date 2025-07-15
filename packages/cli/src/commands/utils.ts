import { execSync } from 'child_process';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';

export function getPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent || '';
  const execPath = process.env.npm_execpath || '';

  // Check user agent first
  if (userAgent.includes('yarn')) {
    return 'yarn';
  }
  if (userAgent.includes('pnpm')) {
    return 'pnpm';
  }
  if (userAgent.includes('npm')) {
    return 'npm';
  }

  // Fallback to execpath check
  if (execPath.includes('yarn')) {
    return 'yarn';
  }
  if (execPath.includes('pnpm')) {
    return 'pnpm';
  }
  if (execPath.includes('npm')) {
    return 'npm';
  }

  // If no environment hints, detect globally installed package managers
  return detectGlobalPackageManager();
}

/**
 * Detects globally installed package managers when no context is available
 * (e.g., when running before installing a template)
 */
export function detectGlobalPackageManager(): string {
  // 1. Check for global config files in user's home directory
  const homeDir = homedir();

  // Check for .yarnrc.yml (Yarn 2+)
  if (existsSync(join(homeDir, '.yarnrc.yml'))) {
    if (isCommandAvailable('yarn')) {
      return 'yarn';
    }
  }

  // Check for .pnpmrc
  if (existsSync(join(homeDir, '.pnpmrc'))) {
    if (isCommandAvailable('pnpm')) {
      return 'pnpm';
    }
  }

  // 2. Check which package managers are actually installed
  // Prefer pnpm > yarn > npm based on performance
  if (isCommandAvailable('pnpm')) {
    return 'pnpm';
  }

  if (isCommandAvailable('yarn')) {
    return 'yarn';
  }

  // npm is almost always available
  return 'npm';
}

/**
 * Checks if a command is available in the system PATH
 */
function isCommandAvailable(command: string): boolean {
  try {
    // Use 'where' on Windows, 'which' on Unix-like systems
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${checkCommand} ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getPackageManagerInstallCommand(pm: string): string {
  switch (pm) {
    case 'npm':
      return 'install';
    case 'yarn':
      return 'add';
    case 'pnpm':
      return 'add';
    default:
      return 'install';
  }
}
