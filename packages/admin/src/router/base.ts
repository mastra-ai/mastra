import type { RouteConfig, RouteHealthStatus, RouteInfo } from '../types';

/**
 * Abstract interface for edge routing.
 * Exposes Mastra servers to the network via reverse proxy or tunnel.
 *
 * Implementations:
 * - LocalEdgeRouter (routers/local/)
 * - CloudflareEdgeRouter (routers/cloudflare/) - future
 */
export interface EdgeRouterProvider {
  /** Router type identifier */
  readonly type: 'local' | 'cloudflare' | string;

  /**
   * Register a route for a deployment.
   *
   * @param config - Route configuration
   * @returns Route info with public URL
   */
  registerRoute(config: RouteConfig): Promise<RouteInfo>;

  /**
   * Update an existing route.
   *
   * @param routeId - ID of the route to update
   * @param config - Partial configuration to update
   * @returns Updated route info
   */
  updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo>;

  /**
   * Remove a route.
   *
   * @param routeId - ID of the route to remove
   */
  removeRoute(routeId: string): Promise<void>;

  /**
   * Get route info for a deployment.
   *
   * @param deploymentId - ID of the deployment
   * @returns Route info or null if not found
   */
  getRoute(deploymentId: string): Promise<RouteInfo | null>;

  /**
   * List all routes for a project.
   *
   * @param projectId - ID of the project
   * @returns List of route infos
   */
  listRoutes(projectId: string): Promise<RouteInfo[]>;

  /**
   * Check health of a route.
   *
   * @param routeId - ID of the route
   * @returns Health status
   */
  checkRouteHealth(routeId: string): Promise<RouteHealthStatus>;
}
