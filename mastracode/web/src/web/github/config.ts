/**
 * Composite feature gate + diagnostics for the GitHub App project feature.
 *
 * The GitHub feature is enabled only when *all three* hold:
 *  - a `GithubIntegration` instance is registered with the factory
 *    (constructed by the deploy entry from the `GITHUB_APP_*` env vars),
 *  - web auth is enabled (a per-user installation requires a logged-in user),
 *  - the application database is configured (`isAppDbConfigured`).
 *
 * OAuth/install `state` signing lives in `../state-signing.ts` — the factory
 * creates one shared signer at boot and hands it to every integration.
 */

import { isWebAuthEnabled } from '../auth';
import { getSeededIntegration, getSeededStateSigner, getSeededStorage } from '../runtime-config';
import { getSandboxProvider, isSandboxEnabled } from '../sandbox/fleet';
import type { GithubIntegration } from './integration';

function getGithubIntegration(): GithubIntegration | undefined {
  const integration = getSeededIntegration('github');
  return integration && 'getInstallationOctokit' in integration ? (integration as GithubIntegration) : undefined;
}

/**
 * Env vars the deploy entry reads to construct a `GithubIntegration`. Names
 * only — used by diagnostics to tell an operator what to set when the
 * integration is absent. The entry enforces all-or-nothing: partial config
 * fails the boot, so at runtime the integration is either fully configured or
 * not configured at all.
 */
const GITHUB_APP_ENV_VARS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_CLIENT_SECRET',
  'GITHUB_APP_SLUG',
] as const;

/**
 * True when the GitHub App project feature should be active.
 */
export function isGithubFeatureEnabled(): boolean {
  return getGithubIntegration() !== undefined && isWebAuthEnabled();
}

/**
 * Non-secret diagnostic snapshot of every GitHub feature gate. Used by startup
 * logs, `/web/github/status`, and the SPA so all three explain the same state.
 *
 * Only env var *names* and booleans are exposed — never secret values.
 */
export interface GithubFeatureDiagnostics {
  githubAppConfigured: boolean;
  webAuthEnabled: boolean;
  appDbConfigured: boolean;
  stateSecretConfigured: boolean;
  sandboxEnabled: boolean;
  sandboxProvider: string;
  /** Names of the GitHub App env vars still needed (empty when configured). */
  missingGithubAppEnvVars: string[];
}

/**
 * Collect a non-secret diagnostic snapshot of every GitHub feature gate. Centralizes
 * the feature-gate reasoning so startup logs, the status API, and the SPA explain
 * the same state. Does not change `isGithubFeatureEnabled()` behavior.
 */
export function getGithubFeatureDiagnostics(): GithubFeatureDiagnostics {
  const github = getGithubIntegration();
  return {
    githubAppConfigured: github !== undefined,
    webAuthEnabled: isWebAuthEnabled(),
    appDbConfigured: getSeededStorage() !== undefined,
    stateSecretConfigured: getSeededStateSigner()?.stable ?? false,
    sandboxEnabled: isSandboxEnabled(),
    sandboxProvider: getSandboxProvider(),
    missingGithubAppEnvVars: github ? [] : [...GITHUB_APP_ENV_VARS],
  };
}
