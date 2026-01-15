/**
 * License validation for EE features.
 */

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
  /** License tier */
  tier?: 'standard' | 'enterprise';
}

// Cached license validation result
let cachedLicense: LicenseInfo | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Validate a license key and return license information.
 *
 * Currently implements a simple check for the presence of the license key.
 * In production, this would validate against a license server.
 *
 * @param licenseKey - License key to validate
 * @returns License information
 */
export function validateLicense(licenseKey?: string): LicenseInfo {
  const key = licenseKey ?? process.env['MASTRA_EE_LICENSE'];

  if (!key) {
    return { valid: false };
  }

  // TODO: Implement actual license validation
  // For now, any non-empty key is considered valid
  // In production, this would:
  // 1. Verify signature of the license key
  // 2. Check expiration date embedded in key
  // 3. Optionally validate against license server

  // Simple validation: key should be at least 32 characters
  if (key.length < 32) {
    return { valid: false };
  }

  return {
    valid: true,
    features: ['user', 'session', 'sso', 'rbac', 'acl', 'audit'],
    tier: 'enterprise',
  };
}

/**
 * Check if EE features are enabled (valid license or cache).
 *
 * @returns True if EE features should be enabled
 */
export function isEELicenseValid(): boolean {
  const now = Date.now();

  // Return cached result if still valid
  if (cachedLicense && now - cacheTimestamp < CACHE_TTL) {
    return cachedLicense.valid;
  }

  // Validate and cache
  cachedLicense = validateLicense();
  cacheTimestamp = now;

  if (!cachedLicense.valid && process.env['MASTRA_EE_LICENSE']) {
    console.warn('[mastra/auth-ee] Invalid or expired EE license. EE features are disabled.');
  }

  return cachedLicense.valid;
}

/**
 * Check if a specific EE feature is enabled.
 *
 * @param feature - Feature name to check
 * @returns True if the feature is enabled
 */
export function isFeatureEnabled(feature: string): boolean {
  if (!isEELicenseValid()) {
    return false;
  }

  // If license is valid but no features array, all features are enabled
  if (!cachedLicense?.features) {
    return true;
  }

  return cachedLicense.features.includes(feature);
}

/**
 * Get the current license information.
 *
 * @returns License info or null if not validated yet
 */
export function getLicenseInfo(): LicenseInfo | null {
  return cachedLicense;
}

/**
 * Clear the license cache (useful for testing).
 */
export function clearLicenseCache(): void {
  cachedLicense = null;
  cacheTimestamp = 0;
}
