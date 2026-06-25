import type { IMastraLogger } from '../logger';

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
    const cleanKey = (val?: string) => (val && val !== 'undefined' && val !== 'null' ? val : undefined);
    this.licenseKey = cleanKey(process.env.MASTRA_LICENSE_KEY) || cleanKey(process.env.MASTRA_EE_LICENSE);
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
