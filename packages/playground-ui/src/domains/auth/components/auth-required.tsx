import { LogoWithoutText } from '@/ds/components/Logo/MastraLogo';

import { useAuthCapabilities } from '../hooks/use-auth-capabilities';
import { isAuthenticated } from '../types';
import { LoginButton } from './login-button';

export type AuthRequiredProps = {
  children: React.ReactNode;
  /** URL to redirect to for login (defaults to /login) */
  loginUrl?: string;
  /** URL to redirect to for signup (defaults to /signup) */
  signupUrl?: string;
};

/**
 * Wrapper component that shows a login prompt when authentication is required.
 *
 * If auth is enabled and the user is not authenticated, displays a message
 * prompting them to sign in. Otherwise, renders children normally.
 *
 * @example
 * ```tsx
 * import { AuthRequired } from '@mastra/playground-ui';
 *
 * function ProtectedPage() {
 *   return (
 *     <AuthRequired>
 *       <MyProtectedContent />
 *     </AuthRequired>
 *   );
 * }
 * ```
 */
export function AuthRequired({ children, loginUrl = '/login', signupUrl = '/signup' }: AuthRequiredProps) {
  const { data: capabilities, isLoading } = useAuthCapabilities();

  // While loading, show nothing (or could show a skeleton)
  if (isLoading) {
    return <>{children}</>;
  }

  // If auth is not enabled, render children
  if (!capabilities?.enabled) {
    return <>{children}</>;
  }

  // If user is authenticated, render children
  if (isAuthenticated(capabilities)) {
    return <>{children}</>;
  }

  // User is not authenticated - show login prompt
  const redirectUri = typeof window !== 'undefined' ? window.location.href : undefined;

  // No login capability available - show auth required message without login option
  if (!capabilities.login) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-6 text-center">
          <LogoWithoutText className="h-16 w-16 opacity-50" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral6">Authentication Required</h2>
            <p className="max-w-sm text-neutral3">
              This page requires authentication, but no login method is configured. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login capability available - show sign in prompt
  const handleSignUp = () => {
    const url = new URL(signupUrl, window.location.origin);
    if (redirectUri) {
      url.searchParams.set('redirect', redirectUri);
    }
    window.location.href = url.toString();
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-6 text-center">
        <LogoWithoutText className="h-16 w-16 opacity-50" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-neutral6">Sign in to continue</h2>
          <p className="max-w-sm text-neutral3">You need to sign in to access this page.</p>
        </div>
        <LoginButton config={capabilities.login} redirectUri={redirectUri} loginUrl={loginUrl} />
        {(capabilities.login.type === 'credentials' || capabilities.login.type === 'both') &&
          capabilities.login.signUpEnabled !== false && (
            <div className="text-sm">
              <span className="text-neutral3">{"Don't have an account? "}</span>
              <button type="button" onClick={handleSignUp} className="text-neutral6 hover:underline">
                Sign up
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
