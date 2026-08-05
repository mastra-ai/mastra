import { join } from 'node:path';
import { runCommand } from './command.js';

export async function installPnpmProject(projectRoot: string, registry: string, timeoutMs = 180_000) {
  const result = await runCommand('pnpm', ['install', '--frozen-lockfile=false'], {
    cwd: projectRoot,
    timeoutMs,
    env: {
      ...process.env,
      npm_config_registry: registry,
      PNPM_HOME: process.env.PNPM_HOME,
      COREPACK_ENABLE_PROJECT_SPEC: '0',
      npm_config_cache: join(projectRoot, '.npm-cache'),
    },
  });
  if (result.exitCode !== 0) {
    throw new Error(`pnpm install failed (${result.exitCode})\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}
