import { PermissionDenied } from '@mastra/playground-ui';
import { Navigate } from 'react-router';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { getFirstAccessibleRoute } from '@/domains/auth/route-permissions';

export default function NoAccess() {
  const { hasPermission, hasAnyPermission, rbacEnabled, isLoading, isAuthenticated } = usePermissions();

  // Wait for permissions to load
  if (isLoading) {
    return null;
  }

  // If RBAC is disabled or not authenticated, redirect to agents (default)
  if (!rbacEnabled || !isAuthenticated) {
    return <Navigate to="/agents" replace />;
  }

  // Find the first route the user has permission to access
  const firstAccessibleRoute = getFirstAccessibleRoute(hasPermission, hasAnyPermission);

  if (firstAccessibleRoute) {
    return <Navigate to={firstAccessibleRoute} replace />;
  }

  // User truly has no permissions
  return (
    <div className="flex items-center justify-center h-full">
      <PermissionDenied
        title="No Access"
        description="You don't have permission to access any resources in Mastra Studio. Contact your administrator for access."
      />
    </div>
  );
}
