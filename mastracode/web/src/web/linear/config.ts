/**
 * Feature gating for the Linear integration.
 *
 * Linear intake is enabled only when *all three* hold:
 *  - a `LinearIntegration` instance is registered with the factory,
 *  - web auth is enabled (a per-org connection requires a logged-in user),
 *  - the application database is configured (`isAppDbConfigured`).
 *
 * The integration instance is constructed by the deploy entry from the Linear
 * OAuth env vars — no env is read here. OAuth `state` signing uses the shared
 * factory signer (`../state-signing`), the same one the GitHub flow uses.
 */

import { isWebAuthEnabled } from '../auth';
import { getSeededLinearIntegration, getSeededStorage } from '../runtime-config';

/** True when a Linear integration instance is registered with the factory. */
export function isLinearAppConfigured(): boolean {
  return getSeededLinearIntegration() !== undefined;
}

/** True when the Linear intake feature should be active. */
export function isLinearFeatureEnabled(): boolean {
  return isLinearAppConfigured() && isWebAuthEnabled();
}

/**
 * Non-secret diagnostic snapshot of every Linear feature gate, mirroring the
 * GitHub diagnostics shape. Only booleans — never values.
 */
export interface LinearFeatureDiagnostics {
  linearAppConfigured: boolean;
  webAuthEnabled: boolean;
  appDbConfigured: boolean;
}

export function getLinearFeatureDiagnostics(): LinearFeatureDiagnostics {
  const linear = getSeededLinearIntegration();
  return {
    linearAppConfigured: linear !== undefined,
    webAuthEnabled: isWebAuthEnabled(),
    // Storage is a required factory slot, so app persistence is configured
    // whenever the factory booted. Connections live in the generic
    // integration-storage domain.
    appDbConfigured: getSeededStorage() !== undefined,
  };
}
