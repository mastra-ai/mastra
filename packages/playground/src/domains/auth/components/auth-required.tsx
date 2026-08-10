import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Lock } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useAuthCapabilities } from '../hooks/use-auth-capabilities';
import { isAuthenticated } from '../types';
import { LoginButton } from './login-button';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';
import { withStudioBasePath } from '@/lib/studio-base-path';

/**
 * The Studio settings route. It is the only route that stays reachable when
 * auth is enabled but the provider exposes no login method (for example a JWT
 * provider), because it is where the user saves the Authorization header that
 * every other request needs. The page renders from local state only, so it
 * makes no authenticated API call.
 *
 * The match is exact. A future settings subroute must be added here on purpose,
 * and only after it is proven to read no server data.
 */
const SETTINGS_ROUTE = '/settings';

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
 * import { AuthRequired } from '@/domains/auth/components/auth-required';
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
  const { pathname } = useLocation();
  const { isMastraPlatform } = useMastraPlatform();

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
    // Settings has no login method to offer, but it is where the user saves the
    // Authorization header that unlocks the rest of Studio, so keep it open.
    const settingsAvailable = !isMastraPlatform;
    if (settingsAvailable && pathname === SETTINGS_ROUTE) {
      return <>{children}</>;
    }

    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-6 text-center">
          <LogoWithoutText className="h-16 w-16 opacity-50" />
          <div className="space-y-2">
            <h2 className="text-neutral6 text-xl font-semibold">Authentication Required</h2>
            <p className="text-neutral3 max-w-sm">
              {settingsAvailable
                ? 'Studio needs an authorization header to open this page.'
                : 'No login method is configured. Please contact your administrator.'}
            </p>
          </div>
          {settingsAvailable && (
            <Link to={SETTINGS_ROUTE} className="text-neutral6 text-sm hover:underline">
              Add an authorization header in Settings
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Login capability available - show sign in prompt
  const handleSignUp = () => {
    const url = new URL(withStudioBasePath(signupUrl), window.location.origin);
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
          <h2 className="text-neutral6 text-xl font-semibold">Sign in to continue</h2>
          <p className="text-neutral3 max-w-sm">You need to sign in to access this page.</p>
        </div>
        {capabilities.login.description && (
          <div className="border-border1 bg-surface2 flex items-start gap-2.5 rounded-md border p-3 text-left">
            <Lock className="text-neutral4 mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-neutral3 max-w-sm text-sm">{capabilities.login.description}</p>
          </div>
        )}
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
