import { describe, it, expect } from 'vitest';

import { LicenseFeature } from '../../license/types';
import { LicenseValidator } from '../../license/validator';

describe('LicenseValidator', () => {
  describe('development license', () => {
    it('should accept "dev" license key', async () => {
      const validator = new LicenseValidator('dev');
      const info = await validator.validate();

      expect(info.valid).toBe(true);
      expect(info.tier).toBe('enterprise');
      expect(info.organizationName).toBe('Development');
    });

    it('should accept "development" license key', async () => {
      const validator = new LicenseValidator('development');
      const info = await validator.validate();

      expect(info.valid).toBe(true);
      expect(info.tier).toBe('enterprise');
    });

    it('should have all features enabled for dev license', async () => {
      const validator = new LicenseValidator('dev');
      await validator.validate();

      expect(validator.hasFeature(LicenseFeature.LOCAL_RUNNER)).toBe(true);
      expect(validator.hasFeature(LicenseFeature.K8S_RUNNER)).toBe(true);
      expect(validator.hasFeature(LicenseFeature.SSO)).toBe(true);
    });

    it('should have no limits for dev license', async () => {
      const validator = new LicenseValidator('dev');
      await validator.validate();

      expect(validator.canCreateTeam(100)).toBe(true);
      expect(validator.canAddTeamMember('team1', 1000)).toBe(true);
      expect(validator.canCreateProject('team1', 1000)).toBe(true);
    });
  });

  describe('invalid license', () => {
    it('should throw for invalid format', async () => {
      const validator = new LicenseValidator('invalid-key');
      await expect(validator.validate()).rejects.toThrow();
    });

    it('should throw for empty key', async () => {
      const validator = new LicenseValidator('');
      await expect(validator.validate()).rejects.toThrow();
    });
  });

  describe('getLicenseInfo', () => {
    it('should throw if not validated', () => {
      const validator = new LicenseValidator('dev');
      expect(() => validator.getLicenseInfo()).toThrow('License not validated');
    });

    it('should return cached info after validation', async () => {
      const validator = new LicenseValidator('dev');
      await validator.validate();

      const info1 = validator.getLicenseInfo();
      const info2 = validator.getLicenseInfo();

      expect(info1).toBe(info2);
    });
  });

  describe('getEnabledFeatures', () => {
    it('should return empty array if not validated', () => {
      const validator = new LicenseValidator('dev');
      expect(validator.getEnabledFeatures()).toEqual([]);
    });

    it('should return all features for dev license', async () => {
      const validator = new LicenseValidator('dev');
      await validator.validate();

      const features = validator.getEnabledFeatures();
      expect(features).toContain(LicenseFeature.LOCAL_RUNNER);
      expect(features).toContain(LicenseFeature.SSO);
      expect(features.length).toBeGreaterThan(0);
    });
  });
});
