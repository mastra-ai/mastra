import { LicenseFeature, LicenseTier  } from './types';
import type {LicenseInfo} from './types';

/**
 * Features available for each tier.
 */
export const TIER_FEATURES: Record<LicenseTier, LicenseFeature[]> = {
  [LicenseTier.COMMUNITY]: [
    LicenseFeature.LOCAL_RUNNER,
  ],
  [LicenseTier.TEAM]: [
    LicenseFeature.LOCAL_RUNNER,
    LicenseFeature.GITHUB_SOURCE,
    LicenseFeature.AUDIT_LOGS,
  ],
  [LicenseTier.ENTERPRISE]: [
    LicenseFeature.LOCAL_RUNNER,
    LicenseFeature.K8S_RUNNER,
    LicenseFeature.CLOUDFLARE_ROUTER,
    LicenseFeature.GITHUB_SOURCE,
    LicenseFeature.SSO,
    LicenseFeature.AUDIT_LOGS,
    LicenseFeature.ADVANCED_RBAC,
    LicenseFeature.UNLIMITED_USERS,
    LicenseFeature.PRIORITY_SUPPORT,
  ],
};

/**
 * Default limits for each tier.
 */
export const TIER_LIMITS: Record<LicenseTier, { teams: number | null; usersPerTeam: number | null; projects: number | null }> = {
  [LicenseTier.COMMUNITY]: {
    teams: 1,
    usersPerTeam: 3,
    projects: 3,
  },
  [LicenseTier.TEAM]: {
    teams: 5,
    usersPerTeam: 10,
    projects: 20,
  },
  [LicenseTier.ENTERPRISE]: {
    teams: null, // Unlimited
    usersPerTeam: null,
    projects: null,
  },
};

/**
 * Check if a feature is enabled based on license info.
 */
export function isFeatureEnabled(license: LicenseInfo, feature: LicenseFeature): boolean {
  if (!license.valid) {
    return false;
  }

  // Check explicit features first
  if (license.features.includes(feature)) {
    return true;
  }

  // Fall back to tier defaults
  return TIER_FEATURES[license.tier]?.includes(feature) ?? false;
}

/**
 * Get merged features for a license (explicit + tier defaults).
 */
export function getMergedFeatures(license: LicenseInfo): LicenseFeature[] {
  const tierFeatures = TIER_FEATURES[license.tier] ?? [];
  const explicitFeatures = license.features;

  // Merge and deduplicate
  return [...new Set([...tierFeatures, ...explicitFeatures])];
}
