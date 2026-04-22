import { Navigate } from 'react-router';
import { useShouldShowAgentStudio } from '../hooks/use-should-show-agent-studio';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

/**
 * All permissions that gate admin sidebar links.
 * If a user has none of these, they should be redirected to /no-access.
 */
const ADMIN_SIDEBAR_PERMISSIONS = [
  'agents:read',
  'prompts:read',
  'workflows:read',
  'processors:read',
  'mcps:read',
  'tools:read',
  'workspaces:read',
  'request-context:read',
  'scorers:read',
  'datasets:read',
  'observability:read',
  'settings:read',
  'resources:read',
];

/**
 * Decides where to land when the user hits `/`.
 *
 * Admins + users without Agent Studio access go to the default `/agents` list.
 * End-users (when `MastraAgentBuilder` is configured and they have
 * `stored-agents:read`) land on `/agent-studio/agents` so the Studio is the
 * primary experience rather than the admin console.
 *
 * Users with no permissions at all are redirected to `/no-access`.
 *
 * Waits for auth/packages to load before redirecting so we don't flash the
 * admin route to an end-user mid-hydration.
 */
export const StudioIndexRedirect = () => {
  const { showAgentStudio, isLoading: isAgentStudioLoading } = useShouldShowAgentStudio();
  const { hasAnyPermission, rbacEnabled, isLoading: isPermissionsLoading, isAuthenticated } = usePermissions();

  const isLoading = isAgentStudioLoading || isPermissionsLoading;

  if (isLoading) return null;

  // If Agent Studio is available for this user, go there
  if (showAgentStudio) {
    return <Navigate to="/agent-studio/agents" replace />;
  }

  // If RBAC is disabled or user has any admin sidebar permission, go to /agents
  if (!rbacEnabled || !isAuthenticated || hasAnyPermission(ADMIN_SIDEBAR_PERMISSIONS)) {
    return <Navigate to="/agents" replace />;
  }

  // User is authenticated but has no permissions — show no-access page
  return <Navigate to="/no-access" replace />;
};
