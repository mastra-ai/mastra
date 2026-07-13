/**
 * Shared assembly of the MastraCode web surface: the custom `/web/*` API routes
 * (fs / config / github) and the GitHub feature readiness check.
 *
 * The Mastra entry (`src/mastra/index.ts`) — consumed by `mastra dev`, `build`,
 * and `deploy` — assembles its `server.apiRoutes` from here, applying the same
 * fail-soft GitHub gating in every environment.
 */

import type { ApiRoute } from '@mastra/core/server';

import type { MountedMastraCode } from '@mastra/code-sdk';

import { buildConfigRoutes } from './config-routes.js';
import { buildFsRoutes } from './fs-routes.js';
import {
  assertReplicaStableStateSecret,
  getGithubFeatureDiagnostics,
  hasExplicitStateSecret,
  isGithubFeatureEnabled,
} from './github/config.js';
import { ensureAppDbReady } from './github/db.js';
import { buildGithubRoutes } from './github/routes.js';
import { ensureIntakeDbReady } from './intake/db.js';
import { buildIntakeRoutes } from './intake/routes.js';
import { getLinearFeatureDiagnostics, isLinearFeatureEnabled } from './linear/config.js';
import { ensureLinearDbReady } from './linear/db.js';
import { buildLinearRoutes } from './linear/routes.js';
import { registerSandboxReattach } from './sandbox-reattach-registration.js';

// Wire the core workspace seam to this package's sandbox provisioning as soon
// as the web surface is loaded, so sandbox-backed workspaces can reattach.
registerSandboxReattach();

export interface WebApiRoutesDeps {
  controller: MountedMastraCode['controller'];
  authStorage: MountedMastraCode['authStorage'];
  /** Root directory the project picker may browse. Defaults to the user's home. */
  fsRoot?: string;
  /** Public origin used to build GitHub OAuth/install callback URLs. */
  publicOrigin: string;
  /**
   * Whether the GitHub App + cloud-sandbox routes should be included. Resolved
   * ahead of time via {@link resolveGithubReady} so this stays synchronous.
   */
  githubReady: boolean;
  /**
   * Whether the Linear intake routes should be included. Resolved ahead of
   * time via {@link resolveLinearReady} so this stays synchronous.
   */
  linearReady: boolean;
  /**
   * Whether the intake-config routes should be included. Resolved ahead of
   * time via {@link resolveIntakeReady} so this stays synchronous.
   */
  intakeReady: boolean;
}

/**
 * Resolve whether the intake-config routes are ready to serve. Intake config
 * rides on web auth + the app DB and is independent of which integrations are
 * configured; it is only useful when at least one intake source is, so callers
 * pass the already-resolved GitHub/Linear readiness. Fails soft like
 * {@link resolveGithubReady}.
 */
export async function resolveIntakeReady(anySourceReady: boolean): Promise<boolean> {
  if (!anySourceReady) return false;
  try {
    await ensureIntakeDbReady();
    return true;
  } catch (err) {
    process.stderr.write(
      `MastraCode Web: intake config routes disabled (app DB unreachable — ${err instanceof Error ? err.message : String(err)})\n`,
    );
    return false;
  }
}

/**
 * Resolve whether the Linear intake feature is ready to serve. Fails soft like
 * {@link resolveGithubReady} when the app DB can't be reached (log and return
 * `false` so the server still boots), but fails loud when the shared
 * state-signing secret would not be replica-stable.
 */
export async function resolveLinearReady(): Promise<boolean> {
  if (!isLinearFeatureEnabled()) {
    const diag = getLinearFeatureDiagnostics();
    const missing = diag.missingLinearEnvVars;
    process.stderr.write(
      [
        'MastraCode Web: Linear routes disabled',
        `  WorkOS auth:          ${diag.webAuthEnabled ? 'enabled' : 'disabled'}`,
        `  Linear OAuth config:  ${diag.linearAppConfigured ? 'configured' : `missing ${missing.join(', ')}`}`,
        `  App DB:               ${diag.appDbConfigured ? 'configured' : 'not configured (APP_DATABASE_URL missing)'}`,
      ].join('\n') + '\n',
    );
    return false;
  }

  // Fail loud if state signing wouldn't be stable across replicas. Linear's
  // OAuth `state` is signed with the shared secret from `./github/config`, and
  // the GitHub-side assertion is a no-op when the GitHub feature is off — so a
  // Linear-only deployment must run its own check.
  if (!hasExplicitStateSecret()) {
    throw new Error(
      'Linear intake is enabled but no replica-stable state secret is set. ' +
        'Set GITHUB_APP_WEBHOOK_SECRET (or WORKOS_COOKIE_PASSWORD) so the OAuth ' +
        '`state` can be verified across replicas. Without it, the connect callback ' +
        'fails whenever it lands on a different replica than the one that signed it.',
    );
  }

  try {
    await ensureLinearDbReady();
    process.stderr.write('MastraCode Web: Linear routes enabled\n');
    return true;
  } catch (err) {
    process.stderr.write(
      `MastraCode Web: Linear routes disabled (app DB unreachable — ${err instanceof Error ? err.message : String(err)})\n`,
    );
    return false;
  }
}

/**
 * Resolve whether the GitHub App + cloud-sandbox feature is ready to serve.
 *
 * Fails soft: when the feature is enabled but the app DB can't be reached we log
 * and return `false` rather than throwing, so the server still boots with the
 * feature simply disabled. Runs the replica-stable-secret assertion first (fails
 * loud) so a misconfigured multi-replica deploy can't silently break the OAuth
 * callback.
 *
 * Logs a compact diagnostic summary at startup so the developer running
 * `web:dev` can immediately see whether the process loaded `.env` and which
 * gate still blocks GitHub.
 */
export async function resolveGithubReady(): Promise<boolean> {
  const diag = getGithubFeatureDiagnostics();

  // Disabled: explain exactly which gate is missing instead of only a single line.
  if (!isGithubFeatureEnabled()) {
    const missing = diag.missingGithubAppEnvVars;
    const lines = [
      'MastraCode Web: GitHub routes disabled',
      `  WorkOS auth:          ${diag.webAuthEnabled ? 'enabled' : 'disabled'}`,
      `  GitHub App config:    ${diag.githubAppConfigured ? 'configured' : `missing ${missing.join(', ')}`}`,
      `  App DB:               ${diag.appDbConfigured ? 'configured' : 'not configured (APP_DATABASE_URL missing)'}`,
      `  State secret:         ${diag.stateSecretConfigured ? 'configured' : 'random per-process (multi-replica unsafe)'}`,
      `  Sandbox provider:     ${diag.sandboxProvider} (${diag.sandboxEnabled ? 'enabled' : 'disabled'})`,
    ];
    process.stderr.write(`${lines.join('\n')}\n`);
    return false;
  }

  // Fail loud if state signing wouldn't be stable across replicas. A random
  // per-process secret silently breaks the OAuth/install callback on a replica
  // that didn't sign the `state`.
  assertReplicaStableStateSecret();

  try {
    await ensureAppDbReady();
    process.stderr.write(
      [
        'MastraCode Web: GitHub routes enabled',
        `  WorkOS auth:          enabled`,
        `  GitHub App config:    configured`,
        `  App DB:               ready`,
        `  State secret:         ${diag.stateSecretConfigured ? 'configured' : 'random per-process'}`,
        `  Sandbox provider:     ${diag.sandboxProvider} (${diag.sandboxEnabled ? 'enabled' : 'disabled'})`,
      ].join('\n') + '\n',
    );
    return true;
  } catch (err) {
    process.stderr.write(
      [
        'MastraCode Web: GitHub routes disabled (app DB unreachable)',
        `  WorkOS auth:          enabled`,
        `  GitHub App config:    configured`,
        `  App DB:               unavailable — ${err instanceof Error ? err.message : String(err)}`,
        `  State secret:         ${diag.stateSecretConfigured ? 'configured' : 'random per-process'}`,
        `  Sandbox provider:     ${diag.sandboxProvider} (${diag.sandboxEnabled ? 'enabled' : 'disabled'})`,
      ].join('\n') + '\n',
    );
    return false;
  }
}

/**
 * Assemble the custom `/web/*` API routes as Mastra `server.apiRoutes`:
 *   - fs browser routes (project picker), confined to `fsRoot`
 *   - config routes (provider/API-key/model-pack/OM management)
 *   - github routes (only when `githubReady`)
 *   - linear routes (only when `linearReady`)
 */
export function assembleWebApiRoutes(deps: WebApiRoutesDeps): ApiRoute[] {
  return [
    ...buildFsRoutes({ root: deps.fsRoot }),
    ...buildConfigRoutes({ controller: deps.controller, authStorage: deps.authStorage }),
    ...(deps.githubReady ? buildGithubRoutes({ baseUrl: deps.publicOrigin, controller: deps.controller }) : []),
    ...(deps.linearReady ? buildLinearRoutes({ baseUrl: deps.publicOrigin }) : []),
    ...(deps.intakeReady ? buildIntakeRoutes() : []),
  ];
}
