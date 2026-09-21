import { Button } from '@mastra/playground-ui/components/Button';
import { TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Lock, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useSSOLogin } from '../hooks/use-auth-actions';
import { useAuthCapabilities } from '../hooks/use-auth-capabilities';
import { useCredentialsLogin } from '../hooks/use-credentials-login';
import { useCredentialsSignUp } from '../hooks/use-credentials-signup';
import type { SSOConfig } from '../types';
import { LoginLayout } from './login-layout';
import { withStudioBasePath } from '@/lib/studio-base-path';

export type LoginPageProps = {
  /** URL to redirect to after successful login */
  redirectUri?: string;
  /** Callback when login is successful */
  onSuccess?: () => void;
  /** Initial mode - 'signin' or 'signup' */
  initialMode?: 'signin' | 'signup';
  /** Error message to display (e.g. from a failed OAuth redirect) */
  errorMessage?: string | null;
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
 * import { LoginPage } from '@/domains/auth/components/login-page';
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
export function LoginPage({ redirectUri, onSuccess, initialMode = 'signin', errorMessage }: LoginPageProps) {
  const { data: capabilities, isLoading: isLoadingCapabilities } = useAuthCapabilities();
  const { mutate: credentialsLogin, isPending: isLoginPending, error: loginError } = useCredentialsLogin();
  const { mutate: credentialsSignUp, isPending: isSignUpPending, error: signUpError } = useCredentialsSignUp();
  const { mutate: ssoLogin, isPending: isSSOPending } = useSSOLogin();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isLoadingCapabilities) {
    return (
      <div className="bg-surface1 flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!capabilities?.enabled || !capabilities?.login) {
    return (
      <div className="bg-surface1 flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Authentication is not configured</div>
      </div>
    );
  }

  const { login } = capabilities;
  const hasSSO = login.type === 'sso' || login.type === 'both';
  const hasCredentials = login.type === 'credentials' || login.type === 'both';
  const sso = login.sso as SSOConfig | undefined;
  const signUpEnabled = login.signUpEnabled !== false; // defaults to true

  const isSignIn = mode === 'signin' || !signUpEnabled; // force signin mode if signup disabled
  const isPending = isSignIn ? isLoginPending : isSignUpPending;
  const error = isSignIn ? loginError : signUpError;

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else if (redirectUri) {
      window.location.href = redirectUri;
    } else {
      window.location.href = withStudioBasePath('/');
    }
  };

  const handleCredentialsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSignIn) {
      credentialsLogin({ email, password }, { onSuccess: handleSuccess });
    } else {
      credentialsSignUp({ email, password, name: name || undefined }, { onSuccess: handleSuccess });
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

  const description = login.description ? (
    <div className="border-border1 bg-surface1 flex items-start gap-2.5 rounded-md border p-3">
      <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-muted-foreground text-body">{login.description}</p>
    </div>
  ) : null;

  const errorBanner = errorMessage ? (
    <div role="alert">
      <Notice variant="destructive">{errorMessage}</Notice>
    </div>
  ) : null;

  return (
    <LoginLayout
      title={isSignIn ? 'Sign in to Mastra Studio' : 'Create your account'}
      description={description}
      errorBanner={errorBanner}
    >
      {hasCredentials && (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          {!isSignIn && (
            <TextFieldBlock
              name="name"
              label="Name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              variant="default"
              size="lg"
            />
          )}

          <TextFieldBlock
            name="email"
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            variant="default"
            size="lg"
          />

          <TextFieldBlock
            name="password"
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isSignIn ? 'Enter your password' : 'Create a password'}
            required
            variant="default"
            size="lg"
          />

          {error ? (
            <div role="alert">
              <Notice variant="destructive">{error.message}</Notice>
            </div>
          ) : null}

          <Button icon={<LogIn />} type="submit" disabled={isPending} className="w-full" size="lg">
            {isPending ? (isSignIn ? 'Signing in...' : 'Creating account...') : isSignIn ? 'Sign in' : 'Create account'}
          </Button>

          {signUpEnabled && (
            <div className="text-body text-center">
              <span className="text-muted-foreground">
                {isSignIn ? "Don't have an account? " : 'Already have an account? '}
              </span>
              <button type="button" onClick={toggleMode} className="text-foreground hover:underline">
                {isSignIn ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          )}
        </form>
      )}

      {hasSSO && hasCredentials && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="border-border1 w-full border-t" />
          </div>
          <div className="text-body relative flex justify-center">
            <span className="bg-surface1 text-muted-foreground px-2">or continue with</span>
          </div>
        </div>
      )}

      {hasSSO && sso && (
        <Button onClick={handleSSOLogin} disabled={isSSOPending} className="w-full" size="lg" variant="outline">
          {sso.icon && <span className="mr-2">{sso.icon}</span>}
          {isSSOPending ? 'Redirecting...' : sso.text || 'Sign in'}
        </Button>
      )}
    </LoginLayout>
  );
}
