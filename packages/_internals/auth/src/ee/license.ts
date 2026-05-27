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

import { hashTelemetryValue } from './telemetry';

interface IMastraLogger {
  warn(message: string): void;
  info(message: string): void;
  error(message: string): void;
}

export interface LicenseValidationSuccess {
  valid: true;
  /** Feature entitlements granted by the license (e.g. 'rbac', 'sso', 'fga') */
  entitlements: string[];
  /** Plan tier the license was issued for (e.g. 'teams', 'enterprise') */
  planTier: string;
  expiresAt: string | null;
  leaseTtlSeconds: number;
}

export interface LicenseValidationError {
  valid: false;
  code: 'INVALID_KEY' | 'LICENSE_EXPIRED' | 'LICENSE_REVOKED' | 'RATE_LIMITED';
  reason: string;
}

export type LicenseValidationResponse = LicenseValidationSuccess | LicenseValidationError;

export type LicenseMode = 'enterprise' | 'open-source';

export type LicenseStatus = 'pending' | 'valid' | 'invalid';

export interface LicenseSnapshot {
  mode: LicenseMode;
  status: LicenseStatus;
  entitlements: string[] | null;
  planTier: string | null;
  expiresAt: string | null;
}

export class LicenseClient {
  private static instance: LicenseClient | undefined;
  private logger?: IMastraLogger;

  private licenseKey?: string;
  private licenseUrl?: string;

  private mode: LicenseMode = 'open-source';
  private status: LicenseStatus = 'pending';

  private cachedResult: LicenseValidationSuccess | null = null;
  private cacheExpiry: number = 0;
  private gracePeriodEnd: number = 0;

  private revalidationTimeout: NodeJS.Timeout | null = null;
  private readonly GRACE_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 hours
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  private constructor(logger?: IMastraLogger) {
    this.logger = logger;
    // MASTRA_LICENSE_KEY is the primary env var; MASTRA_EE_LICENSE is a
    // supported legacy alias kept for backward compatibility.
    this.licenseKey = process.env.MASTRA_LICENSE_KEY || process.env.MASTRA_EE_LICENSE;
    this.licenseUrl = process.env.MASTRA_LICENSE_URL || 'https://license.mastra.ai';

    if (this.licenseKey) {
      this.mode = 'enterprise';
    } else {
      this.mode = 'open-source';
    }
  }

  public static getInstance(logger?: IMastraLogger): LicenseClient {
    if (!LicenseClient.instance) {
      LicenseClient.instance = new LicenseClient(logger);
    } else if (logger) {
      LicenseClient.instance.logger = logger;
    }
    return LicenseClient.instance;
  }

  /**
   * Reset the singleton so the next getInstance() re-reads env vars.
   * Intended for tests.
   */
  public static resetInstance(): void {
    if (LicenseClient.instance?.revalidationTimeout) {
      clearTimeout(LicenseClient.instance.revalidationTimeout);
    }
    LicenseClient.instance = undefined;
  }

  private readonly REQUEST_TIMEOUT_MS = 10_000;

  private async fetchWithRetry(url: string, options: RequestInit, retries: number = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      // Bound each attempt so a stalled socket can't hang the in-flight
      // validation promise that all concurrent callers share.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);
      timer.unref?.();
      try {
        const signal = options.signal
          ? AbortSignal.any([options.signal as AbortSignal, controller.signal])
          : controller.signal;
        const response = await fetch(url, { ...options, signal });
        if (response.status === 429 || response.status >= 500) {
          if (i === retries - 1) return response;
        } else {
          return response;
        }
      } catch (error) {
        if (i === retries - 1) throw error;
      } finally {
        clearTimeout(timer);
      }
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error('Unreachable');
  }

  private validationPromise: Promise<boolean> | null = null;

  public async validate(): Promise<boolean> {
    if (this.mode === 'open-source') {
      return true;
    }

    // Check if cache is valid
    if (this.cachedResult && Date.now() < this.cacheExpiry) {
      return true;
    }

    return this.revalidate();
  }

  /**
   * Contact the server regardless of cache freshness, coalescing concurrent
   * callers (e.g. the Mastra constructor and the auth/ee helpers both kicking
   * off validation at startup) into a single in-flight request so the server
   * is contacted — and the outcome logged — only once. Used directly by the
   * background revalidation timer, which must bypass the cache check.
   */
  private revalidate(): Promise<boolean> {
    if (!this.validationPromise) {
      this.validationPromise = this.performValidation().finally(() => {
        this.validationPromise = null;
      });
    }
    return this.validationPromise;
  }

  private async performValidation(): Promise<boolean> {
    const now = Date.now();

    // Attempt to validate against server
    try {
      if (!this.licenseUrl?.startsWith('https://') && !this.licenseUrl?.includes('localhost')) {
        this.logger?.warn('License URL is not HTTPS. Proceeding, but this is insecure.');
      }

      const response = await this.fetchWithRetry(`${this.licenseUrl}/validate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ licenseKey: this.licenseKey }),
      });

      // A 429 or 5xx that survived the retries is a transient server
      // condition, not a verdict on the license — treat it like an
      // unreachable server so the lease/grace semantics below apply
      // instead of invalidating the key.
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`License server responded with ${response.status}`);
      }

      const data = (await response.json()) as LicenseValidationResponse;

      if (data.valid) {
        this.status = 'valid';
        this.logger?.info(
          `License validated: ${data.planTier} tier${data.expiresAt ? `, expires ${data.expiresAt.slice(0, 10)}` : ''}`,
        );
        this.cachedResult = data;

        const ttlSeconds = data.leaseTtlSeconds || this.DEFAULT_TTL_MS / 1000;
        this.cacheExpiry = now + ttlSeconds * 1000;
        this.gracePeriodEnd = now + this.GRACE_PERIOD_MS;

        this.scheduleRevalidation(ttlSeconds);
        return true;
      } else if (data.code === 'RATE_LIMITED') {
        // Defensive: a throttle marker in the body without a 429 status is
        // still transient, not a license verdict.
        throw new Error(`License server rate limited: ${data.reason}`);
      } else {
        this.status = 'invalid';
        this.logger?.error(`License validation failed: ${data.code} - ${data.reason}`);
        this.clearCache();
        return false;
      }
    } catch {
      // Network error or server unreachable
      if (this.cachedResult && now < this.gracePeriodEnd) {
        this.logger?.warn('License server unreachable. Using cached license (within grace period).');
        this.status = 'valid';
        this.scheduleRevalidation(this.DEFAULT_TTL_MS / 1000); // Retry later
        return true;
      } else if (this.cachedResult) {
        this.logger?.error('License server unreachable and grace period expired. Disabling enterprise features.');
        this.status = 'invalid';
        this.clearCache();
        return false;
      } else {
        // First call failed
        this.logger?.warn('License server unreachable on startup. Failing open (allowing features) and will retry.');

        // Mock a success to fail open, but set a short TTL to force quick retry
        this.status = 'valid';
        this.cachedResult = {
          valid: true,
          entitlements: [],
          planTier: 'unknown',
          expiresAt: null,
          leaseTtlSeconds: 300, // 5 minutes
        };
        this.cacheExpiry = now + 300 * 1000;
        this.gracePeriodEnd = now + this.GRACE_PERIOD_MS;
        this.scheduleRevalidation(300);
        return true;
      }
    }
  }

  private scheduleRevalidation(ttlSeconds: number) {
    if (this.revalidationTimeout) {
      clearTimeout(this.revalidationTimeout);
    }

    // Revalidate at 75% of TTL
    const revalidateMs = ttlSeconds * 1000 * 0.75;
    this.revalidationTimeout = setTimeout(() => {
      this.logger?.info('Performing background license revalidation...');
      // revalidate(), not validate(): at 75% of TTL the cache is still fresh,
      // so validate()'s early return would skip the refresh entirely.
      this.revalidate().catch(err => {
        this.logger?.error('Background license revalidation failed', err);
      });
    }, revalidateMs);

    // Ensure the timeout doesn't keep the Node process alive
    this.revalidationTimeout.unref();
  }

  private clearCache() {
    this.cachedResult = null;
    this.cacheExpiry = 0;
    this.gracePeriodEnd = 0;
    this.status = 'invalid';
    if (this.revalidationTimeout) {
      clearTimeout(this.revalidationTimeout);
      this.revalidationTimeout = null;
    }
  }

  public hasFeature(featureName: string): boolean {
    if (this.mode === 'open-source') return true;
    if (this.status === 'pending') return true;
    if (this.status === 'invalid') return false;
    if (!this.cachedResult) return false;

    // While failing open (server unreachable on startup) the entitlements
    // list is empty but the unknown planTier marks the result as tentative.
    if (this.cachedResult.planTier === 'unknown') return true;

    return this.cachedResult.entitlements.includes(featureName);
  }

  public getEntitlements(): string[] | null {
    if (this.mode === 'open-source') return null;
    return this.cachedResult?.entitlements || null;
  }

  public getSnapshot(): LicenseSnapshot {
    return {
      mode: this.mode,
      status: this.status,
      entitlements: this.cachedResult?.entitlements ?? null,
      planTier: this.cachedResult?.planTier ?? null,
      expiresAt: this.cachedResult?.expiresAt ?? null,
    };
  }
}


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
