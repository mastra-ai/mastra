import type { RouteStatus } from '@mastra/admin';

/**
 * Routing strategy for local router.
 */
export type RoutingStrategy = 'port-mapping' | 'reverse-proxy';

/**
 * Configuration for LocalEdgeRouter.
 */
export interface LocalEdgeRouterConfig {
  /**
   * Routing strategy to use.
   * - 'port-mapping': Direct port exposure (default)
   * - 'reverse-proxy': HTTP proxy on single port
   * @default 'port-mapping'
   */
  strategy?: RoutingStrategy;

  /**
   * Base domain for local routes.
   * @default 'localhost'
   * @example 'mastra.local' for custom local domains
   */
  baseDomain?: string;

  /**
   * Port range for auto-allocation.
   * @default { start: 3100, end: 3199 }
   */
  portRange?: {
    start: number;
    end: number;
  };

  /**
   * Reverse proxy port (when strategy is 'reverse-proxy').
   * @default 3000
   */
  proxyPort?: number;

  /**
   * Health check configuration.
   */
  healthCheck?: {
    /** Health check endpoint path. @default '/health' */
    path?: string;
    /** Health check interval in ms. @default 30000 */
    intervalMs?: number;
    /** Health check timeout in ms. @default 5000 */
    timeoutMs?: number;
    /** Number of failures before marking unhealthy. @default 3 */
    failureThreshold?: number;
  };

  /**
   * Enable hosts file management for custom local domains.
   * Requires elevated permissions.
   * @default false
   */
  enableHostsFile?: boolean;

  /**
   * Enable local HTTPS with self-signed certificates.
   * @default false
   */
  enableTls?: boolean;

  /**
   * TLS configuration (when enableTls is true).
   */
  tls?: {
    /** Directory to store certificates. @default '~/.mastra/certs' */
    certDir?: string;
    /** Certificate validity in days. @default 365 */
    validityDays?: number;
  };

  /**
   * Enable console logging of route changes.
   * @default true
   */
  logRoutes?: boolean;
}

/**
 * Internal route record with additional metadata.
 */
export interface LocalRoute {
  routeId: string;
  deploymentId: string;
  projectId: string;
  subdomain: string;
  targetHost: string;
  targetPort: number;
  publicUrl: string;
  status: RouteStatus;
  tls: boolean;
  createdAt: Date;
  lastHealthCheck?: Date;
  healthCheckFailures: number;
}
