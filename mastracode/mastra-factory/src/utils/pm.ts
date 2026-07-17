export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/** Detect the package manager that invoked us (`npm create`, `pnpm create`, ...). */
export function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('yarn')) return 'yarn';
  if (agent.startsWith('bun')) return 'bun';
  return 'npm';
}
