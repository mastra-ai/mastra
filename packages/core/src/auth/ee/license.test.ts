import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isDevEnvironment,
  isEEEnabled,
  isFeatureEnabled,
  isLicenseValid,
  validateLicense,
  clearLicenseCache,
} from './license';

describe('license', () => {
  let originalNodeEnv: string | undefined;
  let originalMastraDev: string | undefined;
  let originalLicense: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalMastraDev = process.env['MASTRA_DEV'];
    originalLicense = process.env['MASTRA_EE_LICENSE'];
    clearLicenseCache();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
    else delete process.env['NODE_ENV'];
    if (originalMastraDev !== undefined) process.env['MASTRA_DEV'] = originalMastraDev;
    else delete process.env['MASTRA_DEV'];
    if (originalLicense !== undefined) process.env['MASTRA_EE_LICENSE'] = originalLicense;
    else delete process.env['MASTRA_EE_LICENSE'];
  });

  describe('validateLicense', () => {
    it('should return invalid when no key is provided', () => {
      delete process.env['MASTRA_EE_LICENSE'];
      expect(validateLicense()).toEqual({ valid: false });
    });

    it('should return invalid for keys shorter than 32 characters', () => {
      expect(validateLicense('short-key')).toEqual({ valid: false });
    });

    it('should return valid for keys with 32+ characters', () => {
      const key = 'a'.repeat(32);
      const result = validateLicense(key);
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('enterprise');
      expect(result.features).toContain('fga');
    });

    it('should read from MASTRA_EE_LICENSE env var when no key argument', () => {
      process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
      const result = validateLicense();
      expect(result.valid).toBe(true);
    });
  });

  describe('isLicenseValid', () => {
    it('should return false when no license key is set', () => {
      delete process.env['MASTRA_EE_LICENSE'];
      expect(isLicenseValid()).toBe(false);
    });

    it('should return true when valid license key is set', () => {
      process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
      expect(isLicenseValid()).toBe(true);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for fga when a valid license key is set', () => {
      process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
      expect(isFeatureEnabled('fga')).toBe(true);
    });
  });

  describe('isDevEnvironment', () => {
    it('should return true when MASTRA_DEV is true', () => {
      process.env['MASTRA_DEV'] = 'true';
      process.env['NODE_ENV'] = 'production';
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return true when MASTRA_DEV is 1', () => {
      process.env['MASTRA_DEV'] = '1';
      process.env['NODE_ENV'] = 'production';
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return true when NODE_ENV is development', () => {
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'development';
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return true when NODE_ENV is test', () => {
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'test';
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return true when NODE_ENV is not set', () => {
      delete process.env['MASTRA_DEV'];
      delete process.env['NODE_ENV'];
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return false when NODE_ENV is production', () => {
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'production';
      expect(isDevEnvironment()).toBe(false);
    });

    it('should return false when NODE_ENV is prod', () => {
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'prod';
      expect(isDevEnvironment()).toBe(false);
    });
  });

  describe('isEEEnabled', () => {
    it('should return true in dev environment without a license', () => {
      delete process.env['MASTRA_EE_LICENSE'];
      process.env['NODE_ENV'] = 'development';
      expect(isEEEnabled()).toBe(true);
    });

    it('should return true in dev environment even with MASTRA_DEV=true and NODE_ENV=production', () => {
      delete process.env['MASTRA_EE_LICENSE'];
      process.env['MASTRA_DEV'] = 'true';
      process.env['NODE_ENV'] = 'production';
      expect(isEEEnabled()).toBe(true);
    });

    it('should return false in production without a license', () => {
      delete process.env['MASTRA_EE_LICENSE'];
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'production';
      expect(isEEEnabled()).toBe(false);
    });

    it('should return true in production with a valid license', () => {
      process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'production';
      expect(isEEEnabled()).toBe(true);
    });

    it('should return false in production with an invalid license', () => {
      process.env['MASTRA_EE_LICENSE'] = 'short';
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'production';
      expect(isEEEnabled()).toBe(false);
    });
  });
});
