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

  return 'npm'; // Default fallback
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

export function convertToViteEnvVar(envVars: Map<string, string>, keysToConvert: string[]): Map<string, string> {
  const envEntries: [string, string][] = Array.from(envVars.entries());
  const formattedEnvEntries: [string, string][] = envEntries.map(([key, value]) => {
    if (keysToConvert.includes(key)) {
      return [`VITE_${key.toUpperCase()}`, value];
    }
    return [key, value];
  });

  return new Map(formattedEnvEntries);
}
