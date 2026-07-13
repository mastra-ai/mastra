/**
 * Feature gating for the Linear integration.
 *
 * Linear intake is enabled only when *all three* hold:
 *  - the Linear OAuth env vars are present (`isLinearAppConfigured`),
 *  - web auth is enabled (a per-org connection requires a logged-in user),
 *  - the application database is configured (`isAppDbConfigured`).
 *
 * OAuth `state` signing is shared with the GitHub feature (`../github/config`):
 * both bind the same `(orgId, userId)` tenant with the same HMAC secret.
 */

import { isWebAuthEnabled } from '../auth';
import { isAppDbConfigured } from '../github/db';
import { getMissingLinearEnvVars, isLinearAppConfigured } from './client';

/** True when the Linear intake feature should be active. */
export function isLinearFeatureEnabled(): boolean {
  return isLinearAppConfigured() && isWebAuthEnabled() && isAppDbConfigured();
}

/**
 * Non-secret diagnostic snapshot of every Linear feature gate, mirroring the
 * GitHub diagnostics shape. Only env var *names* and booleans — never values.
 */
export interface LinearFeatureDiagnostics {
  linearAppConfigured: boolean;
  webAuthEnabled: boolean;
  appDbConfigured: boolean;
  /** Names of missing required Linear env vars (non-secret names only). */
  missingLinearEnvVars: string[];
}

export function getLinearFeatureDiagnostics(): LinearFeatureDiagnostics {
  return {
    linearAppConfigured: isLinearAppConfigured(),
    webAuthEnabled: isWebAuthEnabled(),
    appDbConfigured: isAppDbConfigured(),
    missingLinearEnvVars: getMissingLinearEnvVars(),
  };
}
