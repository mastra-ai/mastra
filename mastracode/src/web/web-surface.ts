/**
 * Shared assembly of the MastraCode web surface: the custom `/web/*` API routes
 * (fs / config / github) and the GitHub feature readiness check.
 *
 * The Mastra entry (`src/mastra/index.ts`) — consumed by `mastra dev`, `build`,
 * and `deploy` — assembles its `server.apiRoutes` from here, applying the same
 * fail-soft GitHub gating in every environment.
 */

import type { ApiRoute } from '@mastra/core/server';

import type { MountedMastraCode } from '../index.js';

import { buildConfigRoutes } from './config-routes.js';
import { buildFsRoutes } from './fs-routes.js';
import { assertReplicaStableStateSecret, isGithubFeatureEnabled } from './github/config.js';
import { ensureAppDbReady } from './github/db.js';
import { buildGithubRoutes } from './github/routes.js';

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
}

/**
 * Resolve whether the GitHub App + cloud-sandbox feature is ready to serve.
 *
 * Fails soft: when the feature is enabled but the app DB can't be reached we log
 * and return `false` rather than throwing, so the server still boots with the
 * feature simply disabled. Runs the replica-stable-secret assertion first (fails
 * loud) so a misconfigured multi-replica deploy can't silently break the OAuth
 * callback.
 */
export async function resolveGithubReady(): Promise<boolean> {
  if (!isGithubFeatureEnabled()) {
    process.stderr.write('MastraCode GitHub: disabled\n');
    return false;
  }
  // Fail loud if state signing wouldn't be stable across replicas. A random
  // per-process secret silently breaks the OAuth/install callback on a replica
  // that didn't sign the `state`.
  assertReplicaStableStateSecret();
  try {
    await ensureAppDbReady();
    return true;
  } catch (err) {
    process.stderr.write(
      `MastraCode GitHub: app DB unavailable, feature disabled (${err instanceof Error ? err.message : String(err)})\n`,
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
    ...buildFsRoutes({ root: deps.fsRoot }),
    ...buildConfigRoutes({ controller: deps.controller, authStorage: deps.authStorage }),
    ...(deps.githubReady ? buildGithubRoutes({ baseUrl: deps.publicOrigin }) : []),
  ];
}
