/**
 * License validation for EE features.
 *
 * Validation is delegated to the Mastra license server via `LicenseClient`
 * (POST {MASTRA_LICENSE_URL}/validate). The client validates in the
 * background and caches the result; the synchronous helpers in this module
 * read the cached state:
 *
 * - No license key configured → EE features disabled.
 * - Key configured, validation pending → fail open (features enabled) until
 *   the first server response settles the state.
 * - Server says invalid/revoked/expired → EE features disabled.
 * - Server unreachable → fail open with a 72h grace period for previously
 *   validated licenses.
 *
 * `MASTRA_LICENSE_KEY` is the primary env var; `MASTRA_EE_LICENSE` is a
 * supported legacy alias.
 */

import { LicenseClient } from '../../license';
import { hashTelemetryValue } from '../../telemetry/posthog';

/**
 * License information.
 */
export interface LicenseInfo {
  /** Whether the license is valid */
  valid: boolean;
  /** License expiration date */
  expiresAt?: Date;
  /** Features enabled by this license */
  features?: string[];
  /** Organization name */
  organization?: string;
  /** License plan tier (e.g. 'teams', 'enterprise') */
  tier?: string;
}

export interface SafeLicenseSummary {
  valid: boolean;
  isDevEnvironment: boolean;
  licenseHash?: string;
  anonymousId?: string;
  features?: string[];
  tier?: string;
}

/**
 * Resolve the configured license key.
 * `MASTRA_LICENSE_KEY` is primary; `MASTRA_EE_LICENSE` is a supported legacy alias.
 */
function getLicenseKey(): string | undefined {
  return process.env['MASTRA_LICENSE_KEY'] || process.env['MASTRA_EE_LICENSE'];
}

let validationStarted = false;
let hasWarnedAboutDevLicense = false;

/**
 * Get the shared LicenseClient and kick off background validation on first use.
 */
function getClient(): LicenseClient {
  const client = LicenseClient.getInstance();
  if (!validationStarted) {
    validationStarted = true;
    void client.validate().catch(() => {
      // Background validation failures are handled inside LicenseClient
      // (grace period / fail-open). Never let them surface here.
    });
  }
  return client;
}

/**
 * Start license validation against the license server.
 *
 * Safe to call multiple times — the underlying client caches results and
 * schedules its own background revalidation. Resolves to whether the license
 * is currently considered valid.
 */
export function startLicenseValidation(): Promise<boolean> {
  const client = LicenseClient.getInstance();
  validationStarted = true;
  return client.validate();
}

/**
 * Validate the configured license and return license information.
 *
 * Reflects the current server-backed validation state. The actual network
 * validation happens in the background via `LicenseClient`, and only the
 * configured key (env var) is ever validated — passing any other key
 * returns invalid.
 *
 * @param licenseKey - Optional key to check; must match the configured key.
 * @returns License information
 */
export function validateLicense(licenseKey?: string): LicenseInfo {
  const configuredKey = getLicenseKey();
  const key = licenseKey ?? configuredKey;

  if (!key) {
    return { valid: false };
  }

  // The client only ever validates the configured key, so its snapshot can't
  // vouch for any other key the caller supplies.
  if (licenseKey !== undefined && licenseKey !== configuredKey) {
    return { valid: false };
  }

  const snap = getClient().getSnapshot();

  return {
    valid: snap.status !== 'invalid',
    features: snap.entitlements ?? undefined,
    tier: snap.planTier ?? undefined,
    expiresAt: snap.expiresAt ? new Date(snap.expiresAt) : undefined,
  };
}

/**
 * Check if EE features are enabled (valid or pending server validation).
 *
 * @returns True if EE features should be enabled
 */
export function isLicenseValid(): boolean {
  if (!getLicenseKey()) {
    return false;
  }

  // 'valid' or 'pending' (fail open until the first server response).
  // LicenseClient logs the failure reason when the server rejects the key.
  return getClient().getSnapshot().status !== 'invalid';
}

/**
 * @deprecated Use `isLicenseValid()` instead. This alias is provided for backward compatibility.
 */
export const isEELicenseValid = isLicenseValid;

/**
 * Check if a specific EE feature is enabled by the license entitlements.
 *
 * @param feature - Feature name to check (e.g. 'rbac', 'fga', 'sso')
 * @returns True if the feature is enabled
 */
export function isFeatureEnabled(feature: string): boolean {
  if (!getLicenseKey()) {
    return false;
  }

  return getClient().hasFeature(feature);
}

/**
 * Get the current license information.
 *
 * @returns License info or null if no license key is configured
 */
export function getLicenseInfo(): LicenseInfo | null {
  if (!getLicenseKey()) {
    return null;
  }

  return validateLicense();
}

export function getSafeLicenseSummary(): SafeLicenseSummary {
  const key = getLicenseKey();
  const info = validateLicense(key);
  const licenseHash = key ? hashTelemetryValue(key) : undefined;

  return {
    valid: info.valid,
    isDevEnvironment: isDevEnvironment(),
    licenseHash: licenseHash ? licenseHash.slice(0, 16) : undefined,
    anonymousId: licenseHash ? `${licenseHash.slice(0, 16)}-anonymous` : undefined,
    features: info.features,
    tier: info.tier,
  };
}

export function warnIfDevEENeedsLicense(): void {
  if (hasWarnedAboutDevLicense || !isDevEnvironment() || isLicenseValid()) {
    return;
  }

  hasWarnedAboutDevLicense = true;
  console.warn(
    '[mastra/auth-ee] Mastra Enterprise features are enabled for local development, but no valid MASTRA_LICENSE_KEY is configured. These features will be disabled in production without a valid license. Contact us to get a production license: https://mastra.ai/contact',
  );
}

/**
 * Clear the license cache (useful for testing).
 * Resets the shared client so the next check re-reads env vars.
 */
export function clearLicenseCache(): void {
  validationStarted = false;
  hasWarnedAboutDevLicense = false;
  LicenseClient.resetInstance();
}

/**
 * Check if running in a development/testing environment.
 * In dev, EE features work without a license per the ee/LICENSE terms.
 */
export function isDevEnvironment(): boolean {
  return (
    process.env['MASTRA_DEV'] === 'true' ||
    process.env['MASTRA_DEV'] === '1' ||
    (process.env['NODE_ENV'] !== 'production' && process.env['NODE_ENV'] !== 'prod')
  );
}

/**
 * Check if EE features should be active.
 * Returns true if running in dev/test environment (always allowed) or if a valid license is present.
 */
export function isEEEnabled(): boolean {
  if (isDevEnvironment()) {
    warnIfDevEENeedsLicense();
    return true;
  }
  return isLicenseValid();
}
