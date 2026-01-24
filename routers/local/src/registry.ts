import type { LocalRoute } from './types';

/**
 * In-memory route registry for local routing.
 */
export class RouteRegistry {
  private routes: Map<string, LocalRoute> = new Map();
  private byDeploymentId: Map<string, string> = new Map();
  private byProjectId: Map<string, Set<string>> = new Map();

  /**
   * Add a new route to the registry.
   */
  add(route: LocalRoute): void {
    this.routes.set(route.routeId, route);
    this.byDeploymentId.set(route.deploymentId, route.routeId);

    const projectRoutes = this.byProjectId.get(route.projectId) ?? new Set();
    projectRoutes.add(route.routeId);
    this.byProjectId.set(route.projectId, projectRoutes);
  }

  /**
   * Get route by ID.
   */
  get(routeId: string): LocalRoute | undefined {
    return this.routes.get(routeId);
  }

  /**
   * Get route by deployment ID.
   */
  getByDeploymentId(deploymentId: string): LocalRoute | undefined {
    const routeId = this.byDeploymentId.get(deploymentId);
    return routeId ? this.routes.get(routeId) : undefined;
  }

  /**
   * List routes for a project.
   */
  listByProjectId(projectId: string): LocalRoute[] {
    const routeIds = this.byProjectId.get(projectId);
    if (!routeIds) return [];
    return Array.from(routeIds)
      .map(id => this.routes.get(id))
      .filter((r): r is LocalRoute => r !== undefined);
  }

  /**
   * Update a route.
   */
  update(routeId: string, updates: Partial<LocalRoute>): LocalRoute | undefined {
    const route = this.routes.get(routeId);
    if (!route) return undefined;

    const updated = { ...route, ...updates };
    this.routes.set(routeId, updated);
    return updated;
  }

  /**
   * Remove a route.
   */
  remove(routeId: string): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;

    this.routes.delete(routeId);
    this.byDeploymentId.delete(route.deploymentId);

    const projectRoutes = this.byProjectId.get(route.projectId);
    if (projectRoutes) {
      projectRoutes.delete(routeId);
      if (projectRoutes.size === 0) {
        this.byProjectId.delete(route.projectId);
      }
    }

    return true;
  }

  /**
   * Get all routes.
   */
  all(): LocalRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Clear all routes.
   */
  clear(): void {
    this.routes.clear();
    this.byDeploymentId.clear();
    this.byProjectId.clear();
  }
}
