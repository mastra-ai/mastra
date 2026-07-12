import { Spinner } from '@mastra/playground-ui/components/Spinner';
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

  // While the user's permissions load, be defensive: don't leak protected
  // content before gating can run. The authoritative permission patterns are
  // already loaded and validated by RoutePermissionsGate higher in the tree.
  if (isLoading) {
    return (
      <div className="flex size-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // No RBAC or not authenticated — no gating
  if (!rbacEnabled || !isAuthenticated) return <>{children}</>;

  const requiredPermission = getPermissionForRoute(pathname);

  // Route not in registry or public — allow through
  if (!requiredPermission || requiredPermission === 'public') return <>{children}</>;

  // User has permission — allow through
  if (hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission)) return <>{children}</>;

  // No permission — redirect to first accessible route.
  const fallback = getFirstAccessibleRoute(hasPermission, hasAnyPermission);

  // Guard against an infinite redirect loop: if the computed fallback is the
  // page we're already on (e.g. the user has no accessible gated route and
  // we're already on the public fallback), render the children instead of
  // navigating back to ourselves.
  if (fallback === pathname) return <>{children}</>;

  return <Navigate to={fallback} replace />;
}
