import { useState } from 'react';
import { Button } from '@/ds/components/Button/Button';
import { Input } from '@/ds/components/Input';
import { LogoWithoutText } from '@/ds/components/Logo/MastraLogo';

import { useCredentialsLogin } from '../hooks/use-credentials-login';
import { useCredentialsSignup } from '../hooks/use-credentials-signup';
import { useAuthCapabilities } from '../hooks/use-auth-capabilities';
import { useSSOLogin } from '../hooks/use-auth-actions';
import type { SSOConfig } from '../types';

export type LoginPageProps = {
  /** URL to redirect to after successful login */
  redirectUri?: string;
  /** Callback when login is successful */
  onSuccess?: () => void;
  /** Initial mode - 'signin' or 'signup' */
  initialMode?: 'signin' | 'signup';
};

/**
 * Login page component.
 *
 * Renders a login/signup form based on the auth capabilities:
 * - For SSO-only: Shows SSO login button
 * - For credentials-only: Shows email/password form with sign in/sign up toggle
 * - For both: Shows both options
 *
 * @example
 * ```tsx
 * import { LoginPage } from '@mastra/playground-ui';
 *
 * function LoginRoute() {
 *   return (
 *     <LoginPage
 *       redirectUri={window.location.origin}
 *       onSuccess={() => window.location.href = '/'}
 *     />
 *   );
 * }
 * ```
 */
export function LoginPage({ redirectUri, onSuccess, initialMode = 'signin' }: LoginPageProps) {
  const { data: capabilities, isLoading: isLoadingCapabilities } = useAuthCapabilities();
  const loginHook = useCredentialsLogin();
  const signupHook = useCredentialsSignup();
  const { mutate: ssoLogin, isPending: isSSOPending } = useSSOLogin();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  if (isLoadingCapabilities) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface1">
        <div className="text-neutral3">Loading...</div>
      </div>
    );
  }

  if (!capabilities?.enabled || !capabilities?.login) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface1">
        <div className="text-neutral3">Authentication is not configured</div>
      </div>
    );
  }

  const { login } = capabilities;
  const hasSSO = login.type === 'sso' || login.type === 'both';
  const hasCredentials = login.type === 'credentials' || login.type === 'both';
  const sso = login.sso as SSOConfig | undefined;
  const signUpEnabled = login.signUpEnabled !== false; // defaults to true

  const isSignIn = mode === 'signin' || !signUpEnabled; // force signin mode if signup disabled
  const currentHook = isSignIn ? loginHook : signupHook;
  const isPending = currentHook.isLoading;
  const error = currentHook.error;

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else if (redirectUri) {
      window.location.href = redirectUri;
    } else {
      window.location.href = '/';
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (isSignIn) {
        await loginHook.signIn();
        handleSuccess();
      } else {
        await signupHook.signUp();
        handleSuccess();
      }
    } catch (error) {
      // Error is already captured in the hook
      console.error('Auth error:', error);
    }
  };

  const handleSSOLogin = () => {
    ssoLogin(
      { redirectUri },
      {
        onSuccess: data => {
          window.location.href = data.url;
        },
      },
    );
  };

  const toggleMode = () => {
    setMode(isSignIn ? 'signup' : 'signin');
    // Clear any errors when switching modes
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface1">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border1 bg-surface2 p-8">
        <div className="flex flex-col items-center space-y-2">
          <LogoWithoutText className="h-10 w-10" />
          <h1 className="text-xl font-semibold text-neutral6">
            {isSignIn ? 'Sign in to Mastra Studio' : 'Create your account'}
          </h1>
        </div>

        {hasCredentials && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            {!isSignIn && (
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm text-neutral4">
                  Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={signupHook.credentials.name || ''}
                  onChange={e => signupHook.setCredentials({ ...signupHook.credentials, name: e.target.value })}
                  placeholder="Your name"
                  variant="default"
                  size="lg"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm text-neutral4">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={currentHook.credentials.email}
                onChange={e => currentHook.setCredentials({ ...currentHook.credentials, email: e.target.value })}
                placeholder="you@example.com"
                required
                variant="default"
                size="lg"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm text-neutral4">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={currentHook.credentials.password}
                onChange={e => currentHook.setCredentials({ ...currentHook.credentials, password: e.target.value })}
                placeholder={isSignIn ? 'Enter your password' : 'Create a password'}
                required
                variant="default"
                size="lg"
              />
            </div>

            {error && <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

            <Button type="submit" disabled={isPending} className="w-full" size="lg">
              {isPending
                ? isSignIn
                  ? 'Signing in...'
                  : 'Creating account...'
                : isSignIn
                  ? 'Sign in'
                  : 'Create account'}
            </Button>

            {signUpEnabled && (
              <div className="text-center text-sm">
                <span className="text-neutral3">
                  {isSignIn ? "Don't have an account? " : 'Already have an account? '}
                </span>
                <button type="button" onClick={toggleMode} className="text-neutral6 hover:underline">
                  {isSignIn ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            )}
          </form>
        )}

        {hasSSO && hasCredentials && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border1" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-surface2 px-2 text-neutral3">or continue with</span>
            </div>
          </div>
        )}

        {hasSSO && sso && (
          <Button onClick={handleSSOLogin} disabled={isSSOPending} className="w-full" size="lg" variant="outline">
            {sso.icon && <img src={sso.icon} alt="" aria-hidden="true" className="mr-2 h-5 w-5" />}
            {isSSOPending ? 'Redirecting...' : sso.text || 'Sign in with SSO'}
          </Button>
        )}
      </div>
    </div>
  );
}
