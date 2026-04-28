import { Navigate, useLocation } from 'react-router';

import { usePermissions } from '../hooks/use-permissions';
import { getFirstAccessibleRoute, getPermissionForRoute, hasRoutePermission } from '../route-permissions';

/**
 * Guards routes based on the current user's permissions.
 *
 * Checks the current pathname against route-permissions.ts and redirects
 * to the first accessible route when access is denied. Works with both
 * real permissions and previewed role permissions.
 *
 * Routes not in the registry or marked as 'public' are always accessible.
 */
export function RoutePermissionGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { hasPermission, hasAnyPermission, rbacEnabled, isAuthenticated, isLoading } = usePermissions();

  // Don't guard while loading — prevents flash redirects
  if (isLoading) return <>{children}</>;

  // No RBAC or not authenticated — no gating
  if (!rbacEnabled || !isAuthenticated) return <>{children}</>;

  const requiredPermission = getPermissionForRoute(pathname);

  // Route not in registry or public — allow through
  if (!requiredPermission || requiredPermission === 'public') return <>{children}</>;

  // User has permission — allow through
  if (hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission)) return <>{children}</>;

  // No permission — redirect to first accessible route
  const fallback = getFirstAccessibleRoute(hasPermission, hasAnyPermission);
  return <Navigate to={fallback} replace />;
}
