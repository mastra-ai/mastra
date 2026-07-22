export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent || '';
  const execPath = process.env.npm_execpath || '';

  // Check user agent first
  if (userAgent.includes('bun')) {
    return 'bun';
  }
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
  if (execPath.includes('bun')) {
    return 'bun';
  }
  if (execPath.includes('yarn')) {
    return 'yarn';
  }
  if (execPath.includes('pnpm')) {
    return 'pnpm';
  }
  if (execPath.includes('npm')) {
    return 'npm';
  }

  return 'npm'; // Default fallback
}

export function getInstallArgs(packageManager: PackageManager): string[] {
  switch (packageManager) {
    case 'npm':
      return ['install', '--prefer-offline', '--no-audit', '--no-fund'];
    case 'pnpm':
      return ['install', '--prefer-offline'];
    default:
      return ['install'];
  }
}