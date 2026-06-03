import { Spinner } from '@mastra/playground-ui';
import { Navigate, useLocation } from 'react-router';

import { usePermissions } from '../hooks/use-permissions';
import {
  getFirstAccessibleRoute,
  getPermissionForRoute,
  hasRoutePermission,
  useRoutePermissions,
} from '../route-permissions';

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
  const { isLoading: patternsLoading } = useRoutePermissions();

  // While loading, be defensive: don't leak protected content before the gate
  // can run. Show a spinner until both the user's permissions and the
  // authoritative permission patterns (which the route table is validated
  // against) are resolved.
  if (isLoading || patternsLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
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

  // No permission — redirect to first accessible route
  const fallback = getFirstAccessibleRoute(hasPermission, hasAnyPermission);
  return <Navigate to={fallback} replace />;
}
