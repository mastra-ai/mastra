import { useAuthCapabilities } from '../hooks';
import { isAuthenticated } from '../types';
import { LoginButton } from './login-button';
import { UserMenu } from './user-menu';

export type AuthStatusProps = {
  className?: string;
};

/**
 * Auth status component.
 *
 * Displays login button or user menu based on authentication state.
 * Handles all loading and error states internally.
 *
 * @example
 * ```tsx
 * import { AuthStatus } from '@mastra/playground-ui';
 *
 * function Header() {
 *   return (
 *     <header className="flex items-center justify-between">
 *       <Logo />
 *       <AuthStatus />
 *     </header>
 *   );
 * }
 * ```
 */
export function AuthStatus({ className }: AuthStatusProps) {
  const { data: capabilities, isLoading, error } = useAuthCapabilities();

  // Don't render anything while loading
  if (isLoading) return null;

  // Don't render anything if error or auth not enabled
  if (error || !capabilities?.enabled) return null;

  // Show user menu if authenticated
  if (isAuthenticated(capabilities)) {
    return <UserMenu user={capabilities.user} />;
  }

  // Show login button if not authenticated
  return (
    <LoginButton
      config={capabilities.login}
      redirectUri={typeof window !== 'undefined' ? window.location.href : undefined}
      className={className}
    />
  );
}
