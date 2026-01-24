import type { RouteHealthStatus } from '@mastra/admin';

import type { LocalRoute } from './types';

export interface HealthCheckConfig {
  path: string;
  timeoutMs: number;
  failureThreshold: number;
}

/**
 * Performs HTTP health checks on routes.
 */
export class HealthChecker {
  private readonly config: HealthCheckConfig;

  constructor(config: HealthCheckConfig) {
    this.config = config;
  }

  /**
   * Check health of a route.
   */
  async check(route: LocalRoute): Promise<RouteHealthStatus> {
    const url = `http://${route.targetHost}:${route.targetPort}${this.config.path}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          healthy: true,
          latencyMs,
          statusCode: response.status,
        };
      }

      return {
        healthy: false,
        latencyMs,
        statusCode: response.status,
        error: `Non-OK response: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            healthy: false,
            latencyMs,
            error: `Health check timed out after ${this.config.timeoutMs}ms`,
          };
        }
        return {
          healthy: false,
          latencyMs,
          error: error.message,
        };
      }

      return {
        healthy: false,
        latencyMs,
        error: 'Unknown error during health check',
      };
    }
  }

  /**
   * Determine if route should be marked unhealthy.
   */
  shouldMarkUnhealthy(failureCount: number): boolean {
    return failureCount >= this.config.failureThreshold;
  }
}
