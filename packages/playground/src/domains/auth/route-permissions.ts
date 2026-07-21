/**
 * Central registry of Studio routes and their required permissions.
 *
 * This is the single source of truth for:
 * - Which permission(s) are required to view each route
 * - The order of routes for redirect priority (first accessible route wins)
 * - Sidebar link permission gating
 *
 * IMPORTANT: The permission strings below are hardcoded literals. They are
 * validated at runtime against the authoritative permission patterns served by
 * `GET /auth/permission-patterns` (see `RoutePermissionsGate`), so the browser
 * never imports the server-only `@mastra/core/auth/ee` code. The gate preserves
 * the typo protection the old compile-time `P()` validator gave (e.g.
 * 'scorers:read' vs 'scores:read') by throwing on an unknown literal.
 *
 * @see COR-829 Studio View Permissions
 */

import type { PermissionPattern } from '@mastra/client-js';

export type RoutePermission = {
  /** The route path (used for redirects) */
  route: string;
  /**
   * The permission(s) required to access this route.
   * - PermissionPattern: user must have this exact permission
   * - PermissionPattern[]: user must have ANY ONE of these permissions
   *
   * Use 'public' for routes that don't require authentication.
   */
  permission: PermissionPattern | PermissionPattern[] | 'public';
  /** Human-readable name for the route (for debugging/logging) */
  name: string;
};

/**
 * All Studio routes with their required permissions.
 * Ordered by redirect priority - when determining where to send a user,
 * we'll redirect to the first route they have permission to access.
 *
 * Permission literals are validated at runtime by `RoutePermissionsGate`
 * against the server's PERMISSION_PATTERNS. Common gotchas the validation catches:
 * - 'mcp' not 'mcps' (UI route is /mcps but resource is 'mcp')
 * - 'scores' not 'scorers' (UI route is /scorers but resource is 'scores')
 * - 'stored-prompt-blocks' for prompts (uses /stored/prompt-blocks routes)
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Primary routes (highest priority for redirects)
  { route: '/agents', permission: 'agents:read', name: 'Agents' },
  { route: '/workflow-builder', permission: 'stored-workflows:read', name: 'Workflow Builder' },
  { route: '/workflows', permission: 'workflows:read', name: 'Workflows' },

  // Observability - uses 'observability' resource for traces/metrics, 'logs' for logs
  { route: '/metrics', permission: 'observability:read', name: 'Metrics' },
  { route: '/signals', permission: 'observability:read', name: 'Signals' },
  { route: '/observability', permission: 'observability:read', name: 'Traces' },
  { route: '/traces', permission: 'observability:read', name: 'Traces' },
  { route: '/logs', permission: 'logs:read', name: 'Logs' },

  // Evaluation - uses 'scores' resource (not 'scorers')
  { route: '/scorers', permission: 'scores:read', name: 'Scorers' },
  { route: '/datasets', permission: ['datasets:read'], name: 'Datasets' },
  { route: '/experiments', permission: ['datasets:read'], name: 'Experiments' },

  // Primitives - note: 'mcp' not 'mcps', 'stored' for prompts (stored/prompt-blocks routes)
  { route: '/tools', permission: 'tools:read', name: 'Tools' },
  { route: '/mcps', permission: 'mcp:read', name: 'MCP Servers' },
  { route: '/processors', permission: 'processors:read', name: 'Processors' },
  { route: '/prompts', permission: 'stored-prompt-blocks:read', name: 'Prompts' },
  { route: '/workspaces', permission: 'workspaces:read', name: 'Workspaces' },

  // Admin-only pages
  { route: '/request-context', permission: '*', name: 'Request Context' },

  // UI-only pages (no corresponding API resource) - marked as public
  // These pages don't fetch protected data, so they're accessible to all authenticated users
  { route: '/settings', permission: 'public', name: 'Settings' },
  { route: '/resources', permission: 'public', name: 'Resources' },
];

/**
 * Collect the permission literals referenced by the route table (excluding
 * 'public'), so callers can validate them against the server's patterns.
 */
export function collectRouteLiterals(routes: RoutePermission[]): PermissionPattern[] {
  return [
    ...new Set(
      routes.flatMap(r => (Array.isArray(r.permission) ? r.permission : [r.permission])).filter(p => p !== 'public'),
    ),
  ];
}

/**
 * Get all unique permissions used for sidebar gating.
 * Useful for checking if a user has access to ANY sidebar link.
 * Excludes 'public' since those routes are accessible to all authenticated users.
 */
export const ALL_SIDEBAR_PERMISSIONS = collectRouteLiterals(ROUTE_PERMISSIONS);

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
  // No permission required or explicitly public = accessible to all authenticated users
  if (!permission || permission === 'public') return true;

  if (Array.isArray(permission)) {
    return hasAnyPermission(permission);
  }

  return hasPermission(permission);
}

/**
 * Find the first route a user can access based on their permissions.
 * Used for redirecting users who land on a page they can't access.
 *
 * Skips public routes so we prefer gated routes the user has access to.
 * Falls back to /resources (a public route) if no gated routes are accessible.
 */
export function getFirstAccessibleRoute(
  hasPermission: (p: string) => boolean,
  hasAnyPermission: (p: string[]) => boolean,
): string {
  // Get unique routes by permission (first occurrence wins for redirect priority)
  const seen = new Set<string>();
  for (const { route, permission } of ROUTE_PERMISSIONS) {
    // Skip public routes - we want to redirect to a gated route if possible
    if (permission === 'public') continue;

    const key = Array.isArray(permission) ? permission.sort().join(',') : permission;
    if (seen.has(key)) continue;
    seen.add(key);

    if (hasRoutePermission(permission, hasPermission, hasAnyPermission)) {
      return route;
    }
  }
  // Fall back to /resources if no gated routes are accessible
  return '/resources';
}
