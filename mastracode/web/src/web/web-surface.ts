/**
 * Shared assembly of the MastraCode web surface: the custom `/web/*` API routes
 * (fs / config / github) and the GitHub feature readiness check.
 *
 * The Mastra entry (`src/mastra/index.ts`) — consumed by `mastra dev`, `build`,
 * and `deploy` — assembles its `server.apiRoutes` from here, applying the same
 * fail-soft GitHub gating in every environment.
 */

import type { ApiRoute } from '@mastra/core/server';

import { assembleCoreWebApiRoutes } from './core-web-surface.js';
import type { CoreWebApiRoutesDeps } from './core-web-surface.js';
import {
  assertReplicaStableStateSecret,
  getGithubFeatureDiagnostics,
  isGithubFeatureEnabled,
} from './github/config.js';
import { ensureAppDbReady } from './github/db.js';
import { buildGithubRoutes } from './github/routes.js';
import { registerSandboxReattach } from './sandbox-reattach-registration.js';

// Wire the core workspace seam to this package's sandbox provisioning as soon
// as the web surface is loaded, so sandbox-backed workspaces can reattach.
registerSandboxReattach();

export interface WebApiRoutesDeps extends CoreWebApiRoutesDeps {
  /** Public origin used to build GitHub OAuth/install callback URLs. */
  publicOrigin: string;
  /**
   * Whether the GitHub App + cloud-sandbox routes should be included. Resolved
   * ahead of time via {@link resolveGithubReady} so this stays synchronous.
   */
  githubReady: boolean;
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
 */
export function assembleWebApiRoutes(deps: WebApiRoutesDeps): ApiRoute[] {
  return [
    ...assembleCoreWebApiRoutes(deps),
    ...(deps.githubReady ? buildGithubRoutes({ baseUrl: deps.publicOrigin }) : []),
  ];
}
