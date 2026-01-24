export interface HealthCheckConfig {
  /** Timeout for each request (ms) */
  timeoutMs: number;
  /** Interval between retries (ms) */
  retryIntervalMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Health check endpoint */
  endpoint: string;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeoutMs: 5000,
  retryIntervalMs: 1000,
  maxRetries: 30,
  endpoint: '/health',
};

/**
 * HTTP health checker for running servers.
 */
export class HealthChecker {
  private readonly config: HealthCheckConfig;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check health of a server once.
   */
  async check(host: string, port: number): Promise<{ healthy: boolean; message?: string }> {
    const url = `http://${host}:${port}${this.config.endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { healthy: true };
      }

      return {
        healthy: false,
        message: `Health check returned status ${response.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        message: `Health check failed: ${message}`,
      };
    }
  }

  /**
   * Wait for server to become healthy with retries.
   */
  async waitForHealthy(host: string, port: number): Promise<void> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const result = await this.check(host, port);

      if (result.healthy) {
        return;
      }

      lastError = result.message;

      // Wait before retry (except on last attempt)
      if (attempt < this.config.maxRetries) {
        await this.sleep(this.config.retryIntervalMs);
      }
    }

    throw new Error(
      `Server failed to become healthy after ${this.config.maxRetries} attempts. ` +
        `Last error: ${lastError ?? 'unknown'}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
