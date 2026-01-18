import { type ReactNode, useEffect } from 'react';
import { useCurrentUser } from '../hooks/use-current-user.js';
import { usePermissions } from '../hooks/use-permissions.js';
import { Spinner } from '@/ds/components/Spinner/spinner.js';

export interface AuthRequiredProps {
  /** Content to render when authenticated and authorized */
  children: ReactNode;
  /** URL to redirect to for login (defaults to /login) */
  redirectTo?: string;
  /** Required permissions - user must have at least one */
  requiredPermissions?: string[];
  /** Whether all required permissions must be present (AND) vs any (OR) */
  requireAll?: boolean;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom access denied component */
  accessDeniedComponent?: ReactNode;
}

/**
 * AuthRequired component guards routes and content requiring authentication.
 *
 * - Shows loading spinner while checking auth state
 * - Redirects to login if not authenticated
 * - Checks permissions if requiredPermissions specified
 * - Shows access denied message if lacking permissions
 * - Renders children if authenticated and authorized
 *
 * @example
 * ```tsx
 * // Require any authentication
 * <AuthRequired>
 *   <Dashboard />
 * </AuthRequired>
 *
 * // Require specific permission
 * <AuthRequired requiredPermissions={['agents:write']}>
 *   <AgentEditor />
 * </AuthRequired>
 *
 * // Require all permissions
 * <AuthRequired
 *   requiredPermissions={['agents:write', 'workflows:execute']}
 *   requireAll
 * >
 *   <AdvancedEditor />
 * </AuthRequired>
 *
 * // Custom login redirect
 * <AuthRequired redirectTo="/auth/signin">
 *   <ProtectedContent />
 * </AuthRequired>
 * ```
 */
export function AuthRequired({
  children,
  redirectTo = '/login',
  requiredPermissions,
  requireAll = false,
  loadingComponent,
  accessDeniedComponent,
}: AuthRequiredProps) {
  const user = useCurrentUser();
  const { hasAnyPermission, hasAllPermissions, isLoading: isLoadingPermissions } = usePermissions();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (user === null) {
      // Build redirect URL with current location as return URL
      const url = new URL(redirectTo, window.location.origin);
      url.searchParams.set('redirect', window.location.href);
      window.location.href = url.toString();
    }
  }, [user, redirectTo]);

  // Loading state - show spinner
  if (user === undefined || isLoadingPermissions) {
    return (
      loadingComponent || (
        <div className="flex items-center justify-center min-h-screen">
          <Spinner className="w-8 h-8 text-mastra-el-3" />
        </div>
      )
    );
  }

  // Not authenticated - will redirect, show loading state
  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8 text-mastra-el-3" />
      </div>
    );
  }

  // Check permissions if required
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasPermission = requireAll ? hasAllPermissions(requiredPermissions) : hasAnyPermission(requiredPermissions);

    if (!hasPermission) {
      return (
        accessDeniedComponent || (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="text-mastra-el-3 text-lg font-semibold">Access Denied</div>
            <div className="text-mastra-el-5 text-sm">You don't have the required permissions to access this page.</div>
            {requiredPermissions.length > 0 && (
              <div className="text-mastra-el-6 text-xs">
                Required: {requiredPermissions.join(requireAll ? ' AND ' : ' OR ')}
              </div>
            )}
          </div>
        )
      );
    }
  }

  // Authenticated and authorized - render protected content
  return <>{children}</>;
}
