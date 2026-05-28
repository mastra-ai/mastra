/**
 * Central registry of Studio routes and their required permissions.
 *
 * This is the single source of truth for:
 * - Which permission(s) are required to view each route
 * - The order of routes for redirect priority (first accessible route wins)
 * - Sidebar link permission gating
 *
 * IMPORTANT: Permission strings are imported from `@mastra/core/auth/ee` (PERMISSION_PATTERNS).
 * This ensures type safety and prevents typos like 'scorers:read' vs 'scores:read'.
 *
 * @see COR-829 Studio View Permissions
 * @see packages/core/src/auth/ee/interfaces/permissions.generated.ts
 */

import type { PermissionPattern } from '@mastra/core/auth/ee';
import { PERMISSION_PATTERNS } from '@mastra/core/auth/ee';

// Validated permission helper - ensures we're using valid patterns from the generated file
const P = <T extends PermissionPattern>(pattern: T): T => {
  if (!(pattern in PERMISSION_PATTERNS)) {
    throw new Error(`Invalid permission pattern: ${pattern}`);
  }
  return pattern;
};

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
 * Permission patterns are validated using P() to ensure they match PERMISSION_PATTERNS.
 * Common gotchas the types will catch:
 * - 'mcp' not 'mcps' (UI route is /mcps but resource is 'mcp')
 * - 'scores' not 'scorers' (UI route is /scorers but resource is 'scores')
 * - 'stored-prompt-blocks' for prompts (uses /stored/prompt-blocks routes)
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Primary routes (highest priority for redirects)
  { route: '/agents', permission: P('agents:read'), name: 'Agents' },
  { route: '/workflows', permission: P('workflows:read'), name: 'Workflows' },

  // Observability - uses 'observability' resource for traces/metrics, 'logs' for logs
  { route: '/metrics', permission: P('observability:read'), name: 'Metrics' },
  { route: '/observability', permission: P('observability:read'), name: 'Traces' },
  { route: '/traces', permission: P('observability:read'), name: 'Traces' },
  { route: '/logs', permission: P('logs:read'), name: 'Logs' },

  // Evaluation - uses 'scores' resource (not 'scorers')
  { route: '/scorers', permission: P('scores:read'), name: 'Scorers' },
  { route: '/datasets', permission: [P('datasets:read')], name: 'Datasets' },
  { route: '/experiments', permission: [P('datasets:read')], name: 'Experiments' },

  // Primitives - note: 'mcp' not 'mcps', 'stored' for prompts (stored/prompt-blocks routes)
  { route: '/tools', permission: P('tools:read'), name: 'Tools' },
  { route: '/mcps', permission: P('mcp:read'), name: 'MCP Servers' },
  { route: '/processors', permission: P('processors:read'), name: 'Processors' },
  { route: '/prompts', permission: P('stored-prompt-blocks:read'), name: 'Prompts' },
  { route: '/workspaces', permission: P('workspaces:read'), name: 'Workspaces' },

  // Admin-only pages
  { route: '/request-context', permission: P('*'), name: 'Request Context' },

  // UI-only pages (no corresponding API resource) - marked as public
  // These pages don't fetch protected data, so they're accessible to all authenticated users
  { route: '/settings', permission: 'public', name: 'Settings' },
  { route: '/resources', permission: 'public', name: 'Resources' },
];

/**
 * Get all unique permissions used for sidebar gating.
 * Useful for checking if a user has access to ANY sidebar link.
 * Excludes 'public' since those routes are accessible to all authenticated users.
 */
export const ALL_SIDEBAR_PERMISSIONS = [
  ...new Set(
    ROUTE_PERMISSIONS.flatMap(r => (Array.isArray(r.permission) ? r.permission : [r.permission])).filter(
      p => p !== 'public',
    ),
  ),
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
