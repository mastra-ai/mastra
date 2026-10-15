import { homedir } from 'node:os';
import { join } from 'node:path';
import type { FactorySandbox } from '@mastra/core/workspace';
import { PlatformFactorySandbox } from '@mastra/platform-workspace';
import { LocalFactorySandbox } from './local-factory-sandbox.js';

/**
 * Host environment passed through to the default local sandbox. Commands run
 * against untrusted repository checkouts, so server secrets (database URLs,
 * API keys, app private keys) must never reach them; only what git and common
 * toolchains need is copied.
 */
export const LOCAL_SANDBOX_ENV_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'TERM',
  'TZ',
  'GIT_EXEC_PATH',
  'GIT_TEMPLATE_DIR',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
] as const;

/**
 * The Platform sandbox needs a credential, a project and an environment:
 * the API client requires the first two, template builds require the third.
 */
export function hasPlatformSandboxEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const hasCredential = ['MASTRA_PLATFORM_ACCESS_TOKEN', 'MASTRA_PLATFORM_SECRET_KEY'].some(key => env[key]?.trim());
  return hasCredential && ['MASTRA_ENVIRONMENT_ID', 'MASTRA_PROJECT_ID'].every(key => env[key]?.trim());
}

export function localSandboxEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of LOCAL_SANDBOX_ENV_KEYS) {
    const value = env[key];
    if (value) result[key] = value;
  }
  return result;
}

export function defaultLocalSandboxRoot(): string {
  return join(homedir(), '.mastracode', 'factory', 'sandboxes');
}

/** The sandbox a factory uses when the host does not configure one. */
export function resolveDefaultFactorySandbox(env: NodeJS.ProcessEnv = process.env): FactorySandbox {
  if (hasPlatformSandboxEnv(env)) return new PlatformFactorySandbox();
  return new LocalFactorySandbox({ root: defaultLocalSandboxRoot(), env: localSandboxEnv(env) });
}
