# LANE 12 - Local Edge Router (parallel with other Phase 2 lanes)

Create implementation plan for LANE 12: @mastra/router-local local edge router.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete first (for EdgeRouterProvider interface).

This includes:
- routers/local/ package setup
- LocalEdgeRouter implementing EdgeRouterProvider interface
- Local routing strategies:
  - Port mapping (direct port exposure)
  - Local reverse proxy (optional, using http-proxy)
  - Hosts file management (optional, for custom local domains)
- Route registration and management:
  - registerRoute(config) - register a route for a deployment
  - updateRoute(routeId, config) - update target host/port
  - removeRoute(routeId) - clean up route
  - getRoute(deploymentId) - get current route info
  - listRoutes(projectId) - list all routes for a project
- Health checking for local services:
  - checkRouteHealth(routeId) - HTTP health check to target
- Development-friendly features:
  - Auto-reload on route changes
  - Console logging of routes
  - Local HTTPS support (self-signed certs, optional)

Key interface to implement:
```typescript
export interface EdgeRouterProvider {
  readonly type: 'local' | 'cloudflare' | string;
  registerRoute(config: RouteConfig): Promise<RouteInfo>;
  updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo>;
  removeRoute(routeId: string): Promise<void>;
  getRoute(deploymentId: string): Promise<RouteInfo | null>;
  listRoutes(projectId: string): Promise<RouteInfo[]>;
  checkRouteHealth(routeId: string): Promise<RouteHealthStatus>;
}
```

Save plan to: thoughts/shared/plans/2025-01-23-router-local.md
