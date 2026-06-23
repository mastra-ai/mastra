import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isDevEnvironment,
  isEEEnabled,
  isFeatureEnabled,
  isLicenseValid,
  validateLicense,
  startLicenseValidation,
  getSafeLicenseSummary,
  clearLicenseCache,
  warnIfDevEENeedsLicense,
} from './license';

const ENV_KEYS = ['NODE_ENV', 'MASTRA_DEV', 'MASTRA_EE_LICENSE', 'MASTRA_LICENSE_KEY', 'MASTRA_LICENSE_URL'] as const;

function mockValidateResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  });
}

const VALID_ENTERPRISE = {
  valid: true,
  entitlements: ['user', 'session', 'sso', 'rbac', 'acl', 'fga', 'agent-builder'],
  planTier: 'enterprise',
  expiresAt: null,
  leaseTtlSeconds: 86400,
};

const VALID_TEAMS = {
  valid: true,
  entitlements: ['user', 'session', 'sso'],
  planTier: 'teams',
  expiresAt: null,
  leaseTtlSeconds: 86400,
};

const INVALID_KEY = {
  valid: false,
  code: 'INVALID_KEY',
  reason: 'Invalid license key',
};

describe('license', () => {
  const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env['MASTRA_LICENSE_URL'] = 'http://localhost:3020';
    clearLicenseCache();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
      else delete process.env[key];
    }
    clearLicenseCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('isLicenseValid', () => {
    it('should return false when no license key is set', () => {
      expect(isLicenseValid()).toBe(false);
    });

    it('should fail open (return true) while server validation is pending', () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-test-key';
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {}))); // never resolves
      expect(isLicenseValid()).toBe(true);
    });

    it('should return true after the server validates the key', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-test-key';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
      await startLicenseValidation();
      expect(isLicenseValid()).toBe(true);
    });

    it('should return false after the server rejects the key', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-bogus';
      vi.stubGlobal('fetch', mockValidateResponse(INVALID_KEY, 401));
      await startLicenseValidation();
      expect(isLicenseValid()).toBe(false);
    });

    it('should accept MASTRA_EE_LICENSE as a legacy alias', async () => {
      process.env['MASTRA_EE_LICENSE'] = 'LIC-legacy-key';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
      await startLicenseValidation();
      expect(isLicenseValid()).toBe(true);
    });
  });

  describe('validate request contract', () => {
    it('should coalesce concurrent validations into a single server request', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-test-key';
      const fetchMock = mockValidateResponse(INVALID_KEY, 401);
      vi.stubGlobal('fetch', fetchMock);

      // Simulates the Mastra constructor and the auth/ee helpers both
      // kicking off validation at startup.
      const [first, second] = await Promise.all([startLicenseValidation(), startLicenseValidation()]);

      expect(first).toBe(false);
      expect(second).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should revalidate in the background at 75% of the lease TTL', async () => {
      vi.useFakeTimers();
      try {
        process.env['MASTRA_LICENSE_KEY'] = 'LIC-ent';
        const fetchMock = mockValidateResponse(VALID_ENTERPRISE);
        vi.stubGlobal('fetch', fetchMock);
        await startLicenseValidation();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // 75% of the 24h lease is 18h; the timer must hit the server again.
        await vi.advanceTimersByTimeAsync(19 * 60 * 60 * 1000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should keep a previously valid license while the server is rate limiting', async () => {
      vi.useFakeTimers();
      try {
        process.env['MASTRA_LICENSE_KEY'] = 'LIC-ent';
        vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
        await startLicenseValidation();

        // Server starts throttling after the lease was granted.
        vi.stubGlobal(
          'fetch',
          mockValidateResponse({ valid: false, code: 'RATE_LIMITED', reason: 'Too many requests' }, 429),
        );

        // Lease (24h) expires — still well within the 72h grace period.
        await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);

        const pending = startLicenseValidation();
        await vi.advanceTimersByTimeAsync(60_000); // cover retry backoff
        await expect(pending).resolves.toBe(true);
        expect(isLicenseValid()).toBe(true);
        expect(isFeatureEnabled('rbac')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should abort hung requests instead of blocking validation forever', async () => {
      vi.useFakeTimers();
      try {
        process.env['MASTRA_LICENSE_KEY'] = 'LIC-test-key';
        // A socket that stalls: the promise only settles when aborted.
        const fetchMock = vi.fn(
          (_url: string, opts: RequestInit) =>
            new Promise((_resolve, reject) => {
              opts.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const pending = startLicenseValidation();
        // 3 attempts x 10s timeout + 1s + 2s backoff = 33s; give it slack.
        await vi.advanceTimersByTimeAsync(40_000);

        // All attempts timed out -> unreachable-on-startup fail-open.
        await expect(pending).resolves.toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should POST the license key as JSON to {MASTRA_LICENSE_URL}/validate', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-test-key';
      const fetchMock = mockValidateResponse(VALID_ENTERPRISE);
      vi.stubGlobal('fetch', fetchMock);

      await startLicenseValidation();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3020/validate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'content-type': 'application/json' }),
          body: JSON.stringify({ licenseKey: 'LIC-test-key' }),
        }),
      );
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return false for any feature when no key is set', () => {
      expect(isFeatureEnabled('rbac')).toBe(false);
    });

    it('should enable rbac/acl/fga for an enterprise license', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-ent';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
      await startLicenseValidation();
      expect(isFeatureEnabled('rbac')).toBe(true);
      expect(isFeatureEnabled('acl')).toBe(true);
      expect(isFeatureEnabled('fga')).toBe(true);
    });

    it('should not enable rbac for a teams license', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-teams';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_TEAMS));
      await startLicenseValidation();
      expect(isFeatureEnabled('sso')).toBe(true);
      expect(isFeatureEnabled('rbac')).toBe(false);
      expect(isFeatureEnabled('fga')).toBe(false);
    });

    it('should return false for all features when the server rejects the key', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-bogus';
      vi.stubGlobal('fetch', mockValidateResponse(INVALID_KEY, 401));
      await startLicenseValidation();
      expect(isFeatureEnabled('rbac')).toBe(false);
    });

    it('should fail open while validation is pending', () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-test-key';
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
      expect(isFeatureEnabled('rbac')).toBe(true);
    });
  });

  describe('validateLicense', () => {
    it('should return invalid when no key is provided', () => {
      expect(validateLicense()).toEqual({ valid: false });
    });

    it('should return invalid for a key that does not match the configured key', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-ent';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
      await startLicenseValidation();
      expect(validateLicense('LIC-some-other-key')).toEqual({ valid: false });
      expect(validateLicense('LIC-ent').valid).toBe(true);
    });

    it('should return invalid for an explicit key when no key is configured', () => {
      expect(validateLicense('LIC-arbitrary')).toEqual({ valid: false });
    });

    it('should reflect server entitlements and tier after validation', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-ent';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
      await startLicenseValidation();
      const result = validateLicense();
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('enterprise');
      expect(result.features).toContain('rbac');
    });
  });

  describe('getSafeLicenseSummary', () => {
    it('should include a truncated hash and anonymousId, never the raw key', async () => {
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-ent-secret-key';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
      await startLicenseValidation();
      const summary = getSafeLicenseSummary();
      expect(summary.valid).toBe(true);
      expect(summary.licenseHash).toHaveLength(16);
      expect(summary.licenseHash).not.toContain('LIC-');
      expect(summary.anonymousId).toBe(`${summary.licenseHash}-anonymous`);
      expect(summary.tier).toBe('enterprise');
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
      process.env['NODE_ENV'] = 'development';
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return true when NODE_ENV is test', () => {
      process.env['NODE_ENV'] = 'test';
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return true when NODE_ENV is not set', () => {
      expect(isDevEnvironment()).toBe(true);
    });

    it('should return false when NODE_ENV is production', () => {
      process.env['NODE_ENV'] = 'production';
      expect(isDevEnvironment()).toBe(false);
    });

    it('should return false when NODE_ENV is prod', () => {
      process.env['NODE_ENV'] = 'prod';
      expect(isDevEnvironment()).toBe(false);
    });
  });

  describe('isEEEnabled', () => {
    it('should return true in dev environment without a license', () => {
      process.env['NODE_ENV'] = 'development';
      expect(isEEEnabled()).toBe(true);
    });

    it('should return true with MASTRA_DEV=true and NODE_ENV=production', () => {
      process.env['MASTRA_DEV'] = 'true';
      process.env['NODE_ENV'] = 'production';
      expect(isEEEnabled()).toBe(true);
    });

    it('should return false in production without a license', () => {
      process.env['NODE_ENV'] = 'production';
      expect(isEEEnabled()).toBe(false);
    });

    it('should return true in production with a server-validated license', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-ent';
      vi.stubGlobal('fetch', mockValidateResponse(VALID_ENTERPRISE));
      await startLicenseValidation();
      expect(isEEEnabled()).toBe(true);
    });

    it('should return false in production with a server-rejected license', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-bogus';
      vi.stubGlobal('fetch', mockValidateResponse(INVALID_KEY, 401));
      await startLicenseValidation();
      expect(isEEEnabled()).toBe(false);
    });
  });

  describe('warnIfDevEENeedsLicense', () => {
    it('should warn in dev without a valid license', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      delete process.env['MASTRA_EE_LICENSE'];
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'development';

      warnIfDevEENeedsLicense();

      expect(warn).toHaveBeenCalledWith(
        '[mastra/auth-ee] Mastra Enterprise features are enabled for local development, but no valid MASTRA_LICENSE_KEY is configured. These features will be disabled in production without a valid license. Contact us to get a production license: https://mastra.ai/contact',
      );
    });

    it('should warn only once across repeated calls', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      delete process.env['MASTRA_EE_LICENSE'];
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'development';

      warnIfDevEENeedsLicense();
      warnIfDevEENeedsLicense();

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should not warn in production without a license', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      delete process.env['MASTRA_EE_LICENSE'];
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'production';

      warnIfDevEENeedsLicense();

      expect(warn).not.toHaveBeenCalled();
    });

    it('should not warn in dev with a license key configured', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      process.env['MASTRA_LICENSE_KEY'] = 'LIC-test-key';
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {}))); // pending → fail open
      delete process.env['MASTRA_DEV'];
      process.env['NODE_ENV'] = 'development';

      warnIfDevEENeedsLicense();

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
