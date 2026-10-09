import { CUSTOM_DOMAIN_UNSUPPORTED_ERROR, isPlatformAuthSupportedHost } from '@mastra/factory/platform-auth-host';
import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { useApiConfig } from '../../api/config';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import {
  navigateAfterSignIn,
  redirectToLogin,
  signInWithPassword,
  signUpWithPassword,
} from '../domains/auth/services/auth';
import { FactoryHalftoneField } from '../domains/auth/components/FactoryHalftoneField';
import { AuthPendingSkeleton } from '../domains/auth/components/RootGuards';
import '../domains/auth/components/sign-in-page.css';

// Browsers can normalize backslashes into cross-origin redirects.
export function safeReturnTo(raw?: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) return '/';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/';
  }
}

function CustomDomainAuthError({ hostname }: { hostname: string }) {
  return (
    <div role="alert" className="border-destructive-edge bg-card rounded-lg border px-4 py-3">
      <Txt as="h2" variant="subheading" className="text-destructive-foreground">
        Mastra Platform sign-in isn&apos;t available on custom domains
      </Txt>
      <Txt as="p" variant="caption" tone="muted" className="mt-2">
        This Factory is served from {hostname}. Mastra Platform authentication only works on Mastra-hosted domains
        (*.mastra.cloud). To use a custom domain, configure your own auth provider — for example WorkOS (WORKOS_API_KEY
        + WORKOS_CLIENT_ID) or Better Auth — and redeploy.
      </Txt>
      <Txt as="p" variant="caption" tone="muted" className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        <a
          href="https://mastra.ai/docs/auth/overview"
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline"
        >
          Auth overview
        </a>
        <a
          href="https://mastra.ai/integrations/auth/workos"
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline"
        >
          WorkOS integration
        </a>
      </Txt>
    </div>
  );
}

function CredentialSignInForm({ returnTo, signUpDisabled }: { returnTo: string; signUpDisabled: boolean }) {
  const { baseUrl } = useApiConfig();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === 'sign-up') {
        await signUpWithPassword(baseUrl, { name, email, password });
      } else {
        await signInWithPassword(baseUrl, { email, password });
      }
      navigateAfterSignIn(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setPending(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="w-full gap-5">
      {mode === 'sign-up' ? (
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input
            type="text"
            size="lg"
            placeholder="Ada Lovelace"
            autoComplete="name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <FieldError />
        </Field>
      ) : null}
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input
          type="email"
          size="lg"
          placeholder="you@company.com"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <FieldError />
      </Field>
      <Field>
        <FieldLabel>Password</FieldLabel>
        <Input
          type="password"
          size="lg"
          placeholder="Enter your password"
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <FieldError />
      </Field>
      {error ? (
        <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
          {error}
        </Txt>
      ) : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
      </Button>
      {!signUpDisabled ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-center"
          onClick={() => {
            setError(null);
            setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up');
          }}
        >
          {mode === 'sign-up' ? 'Have an account? Sign in' : 'New here? Sign up'}
        </Button>
      ) : (
        <Txt as="p" variant="caption" tone="muted" className="text-center">
          Account creation is managed by your administrator.
        </Txt>
      )}
    </Form>
  );
}

export function SignInPage() {
  const { baseUrl } = useApiConfig();
  const auth = useFactoryAuth({ monitorSession: true });
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const returnTo = safeReturnTo(searchParams.get('returnTo') ?? undefined);
  const authError = searchParams.get('error');
  const authErrorDescription = searchParams.get('error_description');
  const accessDenied = authError === 'access_denied';
  const credentialForm = auth.data?.provider === 'better-auth';
  const studioAuth = auth.data?.provider === 'mastra-studio';
  const customDomainBlocked =
    studioAuth &&
    (auth.data?.customDomainUnsupported === true ||
      authError === CUSTOM_DOMAIN_UNSUPPORTED_ERROR ||
      !isPlatformAuthSupportedHost(window.location.hostname));
  const hostedLoginLabel = studioAuth ? 'Sign in with Mastra Platform' : 'Continue with GitHub';
  const hostedLoginPendingLabel = studioAuth ? 'Opening Mastra Platform…' : 'Opening GitHub…';

  // A cached signed-in result may predate the redirect here. Check the cookie
  // again before sending the user back into the protected app.
  if (auth.isPending || !auth.isFetchedAfterMount) return <AuthPendingSkeleton />;

  const canReturnToApp = auth.data && (!auth.data.authEnabled || auth.data.authenticated);
  if (!auth.isFetching && !auth.isError && canReturnToApp) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <main className="bg-background text-foreground min-h-dvh">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 px-6 sm:px-10 lg:grid-cols-[minmax(380px,0.82fr)_minmax(540px,1.18fr)]">
        <section className="relative z-3 flex max-w-xl flex-col justify-center py-11 lg:py-17">
          <Txt as="h1" variant="hero" className="max-w-xl text-balance">
            Build with an agent factory
          </Txt>
          <Txt as="p" variant="lead" tone="muted" className="mt-6 max-w-lg">
            Turn a repository into a working factory. Agents pick up scoped work, collaborate, and ship changes you can
            review.
          </Txt>

          <section aria-label="Authentication" className="mt-10 w-full max-w-md lg:mt-12">
            {authError && !customDomainBlocked ? (
              <div role="alert" className="border-destructive-edge bg-card mb-6 rounded-lg border px-4 py-3">
                <Txt as="p" variant="subheading" className="text-destructive-foreground">
                  {accessDenied ? 'Access denied' : 'Sign-in failed'}
                </Txt>
                {authErrorDescription ? (
                  <Txt as="p" variant="caption" tone="muted" className="mt-1">
                    {authErrorDescription}
                  </Txt>
                ) : null}
                {accessDenied ? (
                  <Txt as="p" variant="caption" tone="muted" className="mt-1">
                    Ask an organization admin to add your account, then sign in again.
                  </Txt>
                ) : null}
              </div>
            ) : null}
            {auth.isError ? (
              <div role="alert" className="space-y-3">
                <Txt as="p" variant="body" tone="muted">
                  Unable to check your sign-in status. Check your connection and try again.
                </Txt>
                <Button onClick={() => void auth.refetch()} disabled={auth.isFetching}>
                  Try again
                </Button>
              </div>
            ) : customDomainBlocked ? (
              <CustomDomainAuthError hostname={window.location.hostname} />
            ) : credentialForm ? (
              <>
                <div className="mb-6">
                  <Txt font="display" as="h2" variant="title">
                    Welcome back
                  </Txt>
                  <Txt as="p" variant="body" tone="muted" className="mt-2">
                    Sign in to continue building with your team.
                  </Txt>
                </div>
                <CredentialSignInForm returnTo={returnTo} signUpDisabled={auth.data?.signUpDisabled === true} />
              </>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-80 max-w-full"
                disabled={redirecting || auth.isPending}
                onClick={() => {
                  setRedirecting(true);
                  redirectToLogin(baseUrl, returnTo);
                }}
              >
                {studioAuth ? (
                  <LogoWithoutText className="w-4" aria-hidden="true" />
                ) : (
                  <GithubIcon aria-hidden="true" />
                )}
                {redirecting ? hostedLoginPendingLabel : hostedLoginLabel}
              </Button>
            )}
          </section>
        </section>

        <FactoryHalftoneField />
      </div>
    </main>
  );
}
