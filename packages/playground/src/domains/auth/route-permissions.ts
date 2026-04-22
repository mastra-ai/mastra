/**
 * Central registry of Studio routes and their required permissions.
 *
 * This is the single source of truth for:
 * - Which permission(s) are required to view each route
 * - The order of routes for redirect priority (first accessible route wins)
 * - Sidebar link permission gating
 *
 * @see COR-829 Studio View Permissions
 */

export type RoutePermission = {
  /** The route path (used for redirects) */
  route: string;
  /**
   * The permission(s) required to access this route.
   * - string: user must have this exact permission
   * - string[]: user must have ANY ONE of these permissions
   */
  permission: string | string[];
  /** Human-readable name for the route (for debugging/logging) */
  name: string;
};

/**
 * All Studio routes with their required permissions.
 * Ordered by redirect priority - when determining where to send a user,
 * we'll redirect to the first route they have permission to access.
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Primary routes (highest priority for redirects)
  { route: '/agents', permission: 'agents:read', name: 'Agents' },
  { route: '/workflows', permission: 'workflows:read', name: 'Workflows' },

  // Observability
  { route: '/metrics', permission: 'observability:read', name: 'Metrics' },
  { route: '/observability', permission: 'observability:read', name: 'Traces' },
  { route: '/traces', permission: 'observability:read', name: 'Traces' },
  { route: '/logs', permission: 'observability:read', name: 'Logs' },

  // Evaluation
  { route: '/scorers', permission: 'scorers:read', name: 'Scorers' },
  { route: '/datasets', permission: ['datasets:read'], name: 'Datasets' },
  { route: '/experiments', permission: ['datasets:read'], name: 'Experiments' },

  // Primitives
  { route: '/tools', permission: 'tools:read', name: 'Tools' },
  { route: '/mcps', permission: 'mcps:read', name: 'MCP Servers' },
  { route: '/processors', permission: 'processors:read', name: 'Processors' },
  { route: '/prompts', permission: 'prompts:read', name: 'Prompts' },
  { route: '/workspaces', permission: 'workspaces:read', name: 'Workspaces' },

  // Other
  { route: '/request-context', permission: 'request-context:read', name: 'Request Context' },
  { route: '/settings', permission: 'settings:read', name: 'Settings' },
  { route: '/resources', permission: 'resources:read', name: 'Resources' },
];

/**
 * Get all unique permissions used for sidebar gating.
 * Useful for checking if a user has access to ANY sidebar link.
 */
export const ALL_SIDEBAR_PERMISSIONS = [
  ...new Set(ROUTE_PERMISSIONS.flatMap(r => (Array.isArray(r.permission) ? r.permission : [r.permission]))),
];

/**
 * Find the permission(s) required for a given route.
 * Returns undefined if the route is not in the registry (public or unknown route).
 */
export function getPermissionForRoute(route: string): string | string[] | undefined {
  // Exact match first
  const exact = ROUTE_PERMISSIONS.find(r => r.route === route);
  if (exact) return exact.permission;

  // Check if route starts with any registered route (for nested routes like /agents/123)
  const parent = ROUTE_PERMISSIONS.find(r => route.startsWith(r.route + '/'));
  return parent?.permission;
}

/**
 * Check if a user has permission to access a route.
 * Handles both single permissions and "any of" permission arrays.
 */
export function hasRoutePermission(
  permission: string | string[] | undefined,
  hasPermission: (p: string) => boolean,
  hasAnyPermission: (p: string[]) => boolean,
): boolean {
  if (!permission) return true; // No permission required = public route

  if (Array.isArray(permission)) {
    return hasAnyPermission(permission);
  }

  return hasPermission(permission);
}

/**
 * Find the first route a user can access based on their permissions.
 * Used for redirecting users who land on a page they can't access.
 */
export function getFirstAccessibleRoute(
  hasPermission: (p: string) => boolean,
  hasAnyPermission: (p: string[]) => boolean,
): string | null {
  // Get unique routes by permission (first occurrence wins for redirect priority)
  const seen = new Set<string>();
  for (const { route, permission } of ROUTE_PERMISSIONS) {
    const key = Array.isArray(permission) ? permission.sort().join(',') : permission;
    if (seen.has(key)) continue;
    seen.add(key);

    if (hasRoutePermission(permission, hasPermission, hasAnyPermission)) {
      return route;
    }
  }
  return null;
}
