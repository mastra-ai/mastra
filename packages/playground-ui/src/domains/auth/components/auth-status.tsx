import { Button } from '@/ds/components/Button/Button';
import { Spinner } from '@/ds/components/Spinner/spinner.js';
import { useCurrentUser } from '../hooks/use-current-user';
import { useAuthCapabilities } from '../hooks/use-auth-capabilities';
import { UserMenu } from './user-menu';
import type { UserMenuProps } from './user-menu';

export interface AuthStatusProps {
  /** URL to redirect to after login */
  loginRedirectUrl?: string;
  /** Custom login page URL (defaults to /login) */
  loginUrl?: string;
  /** Props to pass to UserMenu component */
  userMenuProps?: Omit<UserMenuProps, 'children'>;
  /** Custom loading component while checking auth */
  loadingComponent?: React.ReactNode;
  /** Show auth UI even when auth is disabled */
  showWhenDisabled?: boolean;
}

/**
 * Auth status component that shows sign in button or user menu based on auth state.
 *
 * This component adapts based on the user's authentication state:
 * - Shows loading indicator while checking auth
 * - Shows "Sign In" button when not authenticated
 * - Shows UserMenu when authenticated
 * - Hides when auth is disabled (unless showWhenDisabled is true)
 *
 * @example
 * ```tsx
 * import { AuthStatus } from '@mastra/playground-ui';
 *
 * function Header() {
 *   return (
 *     <header className="flex items-center justify-between p-4">
 *       <h1>My App</h1>
 *       <AuthStatus
 *         loginUrl="/login"
 *         userMenuProps={{
 *           profileUrl: '/profile',
 *           showRolesAndPermissions: true,
 *         }}
 *       />
 *     </header>
 *   );
 * }
 * ```
 */
export function AuthStatus({
  loginRedirectUrl,
  loginUrl = '/login',
  userMenuProps,
  loadingComponent,
  showWhenDisabled = false,
}: AuthStatusProps) {
  const user = useCurrentUser();
  const { data: capabilities, isLoading } = useAuthCapabilities();

  // Don't render if auth is disabled (unless showWhenDisabled is true)
  if (!showWhenDisabled && capabilities && !capabilities.enabled) {
    return null;
  }

  // Show loading state
  if (isLoading || user === undefined) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className="flex items-center justify-center">
        <Spinner className="w-5 h-5 text-mastra-el-3" />
      </div>
    );
  }

  // Show user menu if authenticated
  if (user) {
    return <UserMenu {...userMenuProps} />;
  }

  // Show sign in button if not authenticated
  const handleSignIn = () => {
    const url = new URL(loginUrl, window.location.origin);
    if (loginRedirectUrl) {
      url.searchParams.set('redirect', loginRedirectUrl);
    } else {
      // Use current page as redirect
      url.searchParams.set('redirect', window.location.href);
    }
    window.location.href = url.toString();
  };

  return (
    <Button variant="default" size="sm" onClick={handleSignIn}>
      Sign In
    </Button>
  );
}
