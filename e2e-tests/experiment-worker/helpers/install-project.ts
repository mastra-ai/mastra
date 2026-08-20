import { join } from 'node:path';
import { runCommand } from './command.js';

function installEnvironment(projectRoot: string, registry: string) {
  return {
    ...process.env,
    npm_config_registry: registry,
    PNPM_HOME: process.env.PNPM_HOME,
    COREPACK_ENABLE_PROJECT_SPEC: '0',
    npm_config_cache: join(projectRoot, '.npm-cache'),
  };
}

async function installProject(
  command: string,
  args: string[],
  projectRoot: string,
  registry: string,
  timeoutMs: number,
  environment: NodeJS.ProcessEnv = {},
) {
  const result = await runCommand(command, args, {
    cwd: projectRoot,
    timeoutMs,
    env: { ...installEnvironment(projectRoot, registry), ...environment },
  });
  if (result.exitCode !== 0) {
    throw new Error(`${command} install failed (${result.exitCode})\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

export function installPnpmProject(projectRoot: string, registry: string, timeoutMs = 180_000) {
  return installProject('pnpm', ['install', '--frozen-lockfile=false'], projectRoot, registry, timeoutMs);
}

export function installNpmProject(projectRoot: string, registry: string, timeoutMs = 180_000) {
  return installProject('npm', ['install', '--ignore-scripts=false'], projectRoot, registry, timeoutMs);
}

export function installYarnProject(projectRoot: string, registry: string, timeoutMs = 180_000) {
  return installProject('corepack', ['yarn', 'install', '--no-immutable'], projectRoot, registry, timeoutMs, {
    COREPACK_ENABLE_PROJECT_SPEC: '1',
  });
}
