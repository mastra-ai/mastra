export function getPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent || `npm`;
  if (userAgent.includes(`pnpm/`)) {
    return `pnpm`;
  } else if (userAgent.includes(`yarn/`)) {
    return `yarn`;
  }

  return `npm`;
}
