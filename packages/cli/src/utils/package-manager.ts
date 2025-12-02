export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export function getPackageManagerAddCommand(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'install --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false';
    case 'yarn':
      return 'add';
    case 'pnpm':
      return 'add --loglevel=error';
    case 'bun':
      return 'add';
    default:
      return 'add';
  }
}
