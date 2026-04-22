import { Navigate } from 'react-router';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { getFirstAccessibleRoute } from '@/domains/auth/route-permissions';

/**
 * Decides where to land when the user hits `/`.
 *
 * Users with permissions are redirected to the first accessible route.
 * Users with no permissions at all are redirected to `/no-access`.
 *
 * Waits for auth to load before redirecting so we don't flash the
 * wrong route mid-hydration.
 */
export const StudioIndexRedirect = () => {
  const {
    hasPermission,
    hasAnyPermission,
    rbacEnabled,
    isLoading: isPermissionsLoading,
    isAuthenticated,
  } = usePermissions();

  if (isPermissionsLoading) return null;

  // If RBAC is disabled or not authenticated, go to /agents (default behavior)
  if (!rbacEnabled || !isAuthenticated) {
    return <Navigate to="/agents" replace />;
  }

  // Find the first route the user has permission to access
  const firstAccessibleRoute = getFirstAccessibleRoute(hasPermission, hasAnyPermission);

  if (firstAccessibleRoute) {
    return <Navigate to={firstAccessibleRoute} replace />;
  }

  // User is authenticated but has no permissions — show no-access page
  return <Navigate to="/no-access" replace />;
};
