import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Lock } from 'lucide-react';
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
            <h2 className="text-neutral6 text-xl font-semibold">Authentication Required</h2>
            <p className="text-neutral3 max-w-sm">
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
