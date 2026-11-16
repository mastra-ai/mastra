export function interpolateUrlTemplate(url: string, envVars?: typeof process.env): string {
  return url.replace(/\$\{([^}]+)\}/g, (_match, envVarName: string) => {
    const key = envVarName.trim();
    const value = envVars?.[key] ?? process.env[key];

    if (value === undefined || value === null) {
      throw new Error(`Missing environment variable ${envVarName} required to build provider URL`);
    }

    return value;
  });
}
