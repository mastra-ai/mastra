import { describe, it, expect } from 'vitest';

import { TIER_FEATURES, TIER_LIMITS, isFeatureEnabled, getMergedFeatures } from '../../license/features';
import { LicenseFeature, LicenseTier } from '../../license/types';
import type { LicenseInfo } from '../../license/types';

describe('License Features', () => {
  describe('TIER_FEATURES', () => {
    it('should define features for all tiers', () => {
      expect(TIER_FEATURES[LicenseTier.COMMUNITY]).toBeDefined();
      expect(TIER_FEATURES[LicenseTier.TEAM]).toBeDefined();
      expect(TIER_FEATURES[LicenseTier.ENTERPRISE]).toBeDefined();
    });

    it('community tier should have local-runner', () => {
      expect(TIER_FEATURES[LicenseTier.COMMUNITY]).toContain(LicenseFeature.LOCAL_RUNNER);
    });

    it('enterprise tier should have all features', () => {
      const enterpriseFeatures = TIER_FEATURES[LicenseTier.ENTERPRISE];
      expect(enterpriseFeatures).toContain(LicenseFeature.LOCAL_RUNNER);
      expect(enterpriseFeatures).toContain(LicenseFeature.K8S_RUNNER);
      expect(enterpriseFeatures).toContain(LicenseFeature.SSO);
    });
  });

  describe('TIER_LIMITS', () => {
    it('should define limits for all tiers', () => {
      expect(TIER_LIMITS[LicenseTier.COMMUNITY]).toBeDefined();
      expect(TIER_LIMITS[LicenseTier.TEAM]).toBeDefined();
      expect(TIER_LIMITS[LicenseTier.ENTERPRISE]).toBeDefined();
    });

    it('community tier should have strict limits', () => {
      const limits = TIER_LIMITS[LicenseTier.COMMUNITY];
      expect(limits?.teams).toBeGreaterThan(0);
      expect(limits?.usersPerTeam).toBeGreaterThan(0);
    });

    it('enterprise tier should have no limits (null = unlimited)', () => {
      const limits = TIER_LIMITS[LicenseTier.ENTERPRISE];
      expect(limits?.teams).toBeNull();
      expect(limits?.usersPerTeam).toBeNull();
      expect(limits?.projects).toBeNull();
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for tier features', () => {
      const licenseInfo: LicenseInfo = {
        valid: true,
        tier: LicenseTier.ENTERPRISE,
        features: [],
        expiresAt: null,
        maxTeams: null,
        maxUsersPerTeam: null,
        maxProjects: null,
      };

      expect(isFeatureEnabled(licenseInfo, LicenseFeature.LOCAL_RUNNER)).toBe(true);
    });

    it('should return true for additional features', () => {
      const licenseInfo: LicenseInfo = {
        valid: true,
        tier: LicenseTier.COMMUNITY,
        features: [LicenseFeature.SSO], // Added as extra feature
        expiresAt: null,
        maxTeams: null,
        maxUsersPerTeam: null,
        maxProjects: null,
      };

      // SSO is an additional feature beyond community tier
      expect(isFeatureEnabled(licenseInfo, LicenseFeature.SSO)).toBe(true);
    });

    it('should return false for unavailable features', () => {
      const licenseInfo: LicenseInfo = {
        valid: true,
        tier: LicenseTier.COMMUNITY,
        features: [],
        expiresAt: null,
        maxTeams: null,
        maxUsersPerTeam: null,
        maxProjects: null,
      };

      expect(isFeatureEnabled(licenseInfo, LicenseFeature.SSO)).toBe(false);
    });
  });

  describe('getMergedFeatures', () => {
    it('should merge tier features with additional features', () => {
      const licenseInfo: LicenseInfo = {
        valid: true,
        tier: LicenseTier.COMMUNITY,
        features: [LicenseFeature.SSO],
        expiresAt: null,
        maxTeams: null,
        maxUsersPerTeam: null,
        maxProjects: null,
      };

      const merged = getMergedFeatures(licenseInfo);
      expect(merged).toContain(LicenseFeature.LOCAL_RUNNER); // From community tier
      expect(merged).toContain(LicenseFeature.SSO); // From additional features
    });

    it('should not duplicate features', () => {
      const licenseInfo: LicenseInfo = {
        valid: true,
        tier: LicenseTier.ENTERPRISE,
        features: [LicenseFeature.LOCAL_RUNNER], // Already in enterprise tier
        expiresAt: null,
        maxTeams: null,
        maxUsersPerTeam: null,
        maxProjects: null,
      };

      const merged = getMergedFeatures(licenseInfo);
      const localRunnerCount = merged.filter(f => f === LicenseFeature.LOCAL_RUNNER).length;
      expect(localRunnerCount).toBe(1);
    });
  });
});
