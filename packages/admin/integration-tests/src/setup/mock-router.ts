import type { EdgeRouterProvider, RouteConfig, RouteInfo, RouteHealthStatus } from '@mastra/admin';

/**
 * In-memory router implementation for integration testing.
 *
 * This mock router simulates the EdgeRouterProvider interface
 * without requiring actual network infrastructure.
 */
export class MockEdgeRouter implements EdgeRouterProvider {
  readonly type = 'local' as const;

  private routes = new Map<string, RouteInfo>();
  private routesByDeployment = new Map<string, RouteInfo>();
  private routeCounter = 0;
  private baseDomain: string;
  private portRange: { start: number; end: number };
  private nextPort: number;

  constructor(
    config: {
      baseDomain?: string;
      portRange?: { start: number; end: number };
    } = {},
  ) {
    this.baseDomain = config.baseDomain ?? 'localhost';
    this.portRange = config.portRange ?? { start: 4200, end: 4299 };
    this.nextPort = this.portRange.start;
  }

  /**
   * Register a route for a deployment.
   */
  async registerRoute(config: RouteConfig): Promise<RouteInfo> {
    const routeId = `route-${++this.routeCounter}`;

    // Generate public URL
    const publicUrl = `http://${config.subdomain}.${this.baseDomain}:${this.allocatePort()}`;

    const routeInfo: RouteInfo = {
      routeId,
      deploymentId: config.deploymentId,
      publicUrl,
      status: 'active',
      createdAt: new Date(),
    };

    this.routes.set(routeId, routeInfo);
    this.routesByDeployment.set(config.deploymentId, routeInfo);

    return routeInfo;
  }

  /**
   * Update an existing route.
   */
  async updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo> {
    const route = this.routes.get(routeId);
    if (!route) {
      throw new Error(`Route ${routeId} not found`);
    }

    // If target port changed, update the public URL
    if (config.targetPort) {
      const updatedRoute: RouteInfo = {
        ...route,
        // In a real implementation, we might update the URL
        // For mock, we just keep the existing URL
      };
      this.routes.set(routeId, updatedRoute);
      return updatedRoute;
    }

    return route;
  }

  /**
   * Remove a route.
   */
  async removeRoute(routeId: string): Promise<void> {
    const route = this.routes.get(routeId);
    if (route) {
      this.routesByDeployment.delete(route.deploymentId);
      this.routes.delete(routeId);
    }
  }

  /**
   * Get route info for a deployment.
   */
  async getRoute(deploymentId: string): Promise<RouteInfo | null> {
    return this.routesByDeployment.get(deploymentId) ?? null;
  }

  /**
   * List all routes for a project.
   */
  async listRoutes(_projectId: string): Promise<RouteInfo[]> {
    // In this mock, we don't track projectId per route
    // Return all routes (real implementation would filter by projectId)
    const routes: RouteInfo[] = [];
    for (const route of this.routes.values()) {
      routes.push(route);
    }
    return routes;
  }

  /**
   * Check health of a route.
   */
  async checkRouteHealth(routeId: string): Promise<RouteHealthStatus> {
    const route = this.routes.get(routeId);
    if (!route) {
      return {
        healthy: false,
        error: `Route ${routeId} not found`,
      };
    }

    // Mock implementation - always return unhealthy since there's no actual server
    return {
      healthy: false,
      error: 'No target server running',
    };
  }

  /**
   * Shutdown the router.
   */
  async shutdown(): Promise<void> {
    this.routes.clear();
    this.routesByDeployment.clear();
  }

  /**
   * Allocate a port from the port range.
   */
  private allocatePort(): number {
    const port = this.nextPort;
    this.nextPort = this.nextPort >= this.portRange.end ? this.portRange.start : this.nextPort + 1;
    return port;
  }

  /**
   * Get the number of registered routes (for testing).
   */
  getRouteCount(): number {
    return this.routes.size;
  }

  /**
   * Clear all routes (for testing).
   */
  clear(): void {
    this.routes.clear();
    this.routesByDeployment.clear();
  }
}
