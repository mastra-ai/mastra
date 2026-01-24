import { randomUUID } from 'node:crypto';

import type { EdgeRouterProvider, RouteConfig, RouteHealthStatus, RouteInfo, RouteStatus } from '@mastra/admin';

import { HealthChecker } from './health-checker';
import { PortManager } from './port-manager';
import { RouteRegistry } from './registry';
import type { LocalEdgeRouterConfig, LocalRoute } from './types';

const DEFAULT_CONFIG: Required<Omit<LocalEdgeRouterConfig, 'tls'>> = {
  strategy: 'port-mapping',
  baseDomain: 'localhost',
  portRange: { start: 3100, end: 3199 },
  proxyPort: 3000,
  healthCheck: {
    path: '/health',
    intervalMs: 30000,
    timeoutMs: 5000,
    failureThreshold: 3,
  },
  enableHostsFile: false,
  enableTls: false,
  logRoutes: true,
};

/**
 * Local edge router for development environments.
 *
 * Implements EdgeRouterProvider to manage routing for locally running
 * Mastra servers. Supports port mapping and optional reverse proxy strategies.
 *
 * @example
 * ```typescript
 * const router = new LocalEdgeRouter({
 *   baseDomain: 'localhost',
 *   portRange: { start: 3100, end: 3199 },
 * });
 *
 * // Register a route
 * const route = await router.registerRoute({
 *   deploymentId: 'deploy-123',
 *   projectId: 'project-456',
 *   subdomain: 'my-agent',
 *   targetHost: 'localhost',
 *   targetPort: 3001,
 * });
 * // route.publicUrl = 'http://localhost:3001'
 *
 * // Check health
 * const health = await router.checkRouteHealth(route.routeId);
 * ```
 */
export class LocalEdgeRouter implements EdgeRouterProvider {
  readonly type = 'local' as const;

  private readonly config: Required<Omit<LocalEdgeRouterConfig, 'tls'>> & { tls?: LocalEdgeRouterConfig['tls'] };
  private readonly registry: RouteRegistry;
  private readonly portManager: PortManager;
  private readonly healthChecker: HealthChecker;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: LocalEdgeRouterConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      healthCheck: { ...DEFAULT_CONFIG.healthCheck, ...config.healthCheck },
      portRange: config.portRange ?? DEFAULT_CONFIG.portRange,
    };

    this.registry = new RouteRegistry();
    this.portManager = new PortManager(this.config.portRange);
    this.healthChecker = new HealthChecker({
      path: this.config.healthCheck.path!,
      timeoutMs: this.config.healthCheck.timeoutMs!,
      failureThreshold: this.config.healthCheck.failureThreshold!,
    });
  }

  /**
   * Register a new route for a deployment.
   */
  async registerRoute(config: RouteConfig): Promise<RouteInfo> {
    // Check for existing route
    const existing = this.registry.getByDeploymentId(config.deploymentId);
    if (existing) {
      throw new Error(`Route already exists for deployment ${config.deploymentId}`);
    }

    // Build public URL based on strategy
    const publicUrl = this.buildPublicUrl(config);

    const route: LocalRoute = {
      routeId: `route_${randomUUID().slice(0, 8)}`,
      deploymentId: config.deploymentId,
      projectId: config.projectId,
      subdomain: config.subdomain,
      targetHost: config.targetHost,
      targetPort: config.targetPort,
      publicUrl,
      status: 'pending' as RouteStatus,
      tls: config.tls ?? false,
      createdAt: new Date(),
      healthCheckFailures: 0,
    };

    this.registry.add(route);

    // Perform initial health check
    const health = await this.healthChecker.check(route);
    route.status = health.healthy ? ('active' as RouteStatus) : ('pending' as RouteStatus);
    route.lastHealthCheck = new Date();
    this.registry.update(route.routeId, route);

    if (this.config.logRoutes) {
      console.info(`[LocalEdgeRouter] Route registered: ${config.subdomain} → ${publicUrl}`);
    }

    return this.toRouteInfo(route);
  }

  /**
   * Update an existing route.
   */
  async updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo> {
    const route = this.registry.get(routeId);
    if (!route) {
      throw new Error(`Route not found: ${routeId}`);
    }

    const updates: Partial<LocalRoute> = {};

    if (config.targetHost !== undefined) updates.targetHost = config.targetHost;
    if (config.targetPort !== undefined) updates.targetPort = config.targetPort;
    if (config.subdomain !== undefined) updates.subdomain = config.subdomain;
    if (config.tls !== undefined) updates.tls = config.tls;

    // Rebuild public URL if any URL-affecting field changed
    if (
      config.targetHost !== undefined ||
      config.targetPort !== undefined ||
      config.subdomain !== undefined ||
      config.tls !== undefined
    ) {
      updates.publicUrl = this.buildPublicUrl({
        ...route,
        ...updates,
      } as RouteConfig);
    }

    const updated = this.registry.update(routeId, updates);
    if (!updated) {
      throw new Error(`Failed to update route: ${routeId}`);
    }

    if (this.config.logRoutes) {
      console.info(`[LocalEdgeRouter] Route updated: ${updated.subdomain} → ${updated.publicUrl}`);
    }

    return this.toRouteInfo(updated);
  }

  /**
   * Remove a route.
   */
  async removeRoute(routeId: string): Promise<void> {
    const route = this.registry.get(routeId);
    if (!route) {
      // Idempotent - already removed
      return;
    }

    this.registry.remove(routeId);

    if (this.config.logRoutes) {
      console.info(`[LocalEdgeRouter] Route removed: ${route.subdomain}`);
    }
  }

  /**
   * Get route info for a deployment.
   */
  async getRoute(deploymentId: string): Promise<RouteInfo | null> {
    const route = this.registry.getByDeploymentId(deploymentId);
    return route ? this.toRouteInfo(route) : null;
  }

  /**
   * List all routes for a project.
   */
  async listRoutes(projectId: string): Promise<RouteInfo[]> {
    const routes = this.registry.listByProjectId(projectId);
    return routes.map(r => this.toRouteInfo(r));
  }

  /**
   * Check health of a route.
   */
  async checkRouteHealth(routeId: string): Promise<RouteHealthStatus> {
    const route = this.registry.get(routeId);
    if (!route) {
      return {
        healthy: false,
        error: `Route not found: ${routeId}`,
      };
    }

    const health = await this.healthChecker.check(route);

    // Update route status
    const updates: Partial<LocalRoute> = {
      lastHealthCheck: new Date(),
    };

    if (health.healthy) {
      updates.healthCheckFailures = 0;
      updates.status = 'active' as RouteStatus;
    } else {
      updates.healthCheckFailures = route.healthCheckFailures + 1;
      if (this.healthChecker.shouldMarkUnhealthy(updates.healthCheckFailures)) {
        updates.status = 'unhealthy' as RouteStatus;
      }
    }

    this.registry.update(routeId, updates);

    return health;
  }

  /**
   * Start periodic health checking.
   */
  startHealthChecking(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      const routes = this.registry.all();
      await Promise.all(routes.map(route => this.checkRouteHealth(route.routeId)));
    }, this.config.healthCheck.intervalMs);
  }

  /**
   * Stop periodic health checking.
   */
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get all registered routes.
   */
  getAllRoutes(): RouteInfo[] {
    return this.registry.all().map(r => this.toRouteInfo(r));
  }

  /**
   * Clear all routes.
   */
  clearRoutes(): void {
    this.registry.clear();
    if (this.config.logRoutes) {
      console.info('[LocalEdgeRouter] All routes cleared');
    }
  }

  /**
   * Clean up resources.
   */
  async close(): Promise<void> {
    this.stopHealthChecking();
    this.clearRoutes();
  }

  /**
   * Build public URL based on routing strategy.
   */
  private buildPublicUrl(config: RouteConfig): string {
    const protocol = config.tls ? 'https' : 'http';

    if (this.config.strategy === 'reverse-proxy') {
      // Subdomain-based routing through proxy
      if (this.config.baseDomain === 'localhost') {
        // localhost doesn't support subdomains, use path-based
        return `${protocol}://localhost:${this.config.proxyPort}/${config.subdomain}`;
      }
      return `${protocol}://${config.subdomain}.${this.config.baseDomain}:${this.config.proxyPort}`;
    }

    // Port mapping - direct access to target
    return `${protocol}://${config.targetHost}:${config.targetPort}`;
  }

  /**
   * Convert internal route to RouteInfo.
   */
  private toRouteInfo(route: LocalRoute): RouteInfo {
    return {
      routeId: route.routeId,
      deploymentId: route.deploymentId,
      publicUrl: route.publicUrl,
      status: route.status,
      createdAt: route.createdAt,
      lastHealthCheck: route.lastHealthCheck,
    };
  }
}
