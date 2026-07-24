import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import '@fontsource-variable/mona-sans/standard.css';

import { useApiConfig } from '../../../shared/api/config';
import { useFactoryAuth } from '../../../shared/hooks/useFactoryAuth';
import {
  navigateAfterSignIn,
  redirectToLogin,
  signInWithPassword,
  signUpWithPassword,
} from '../domains/auth/services/auth';
import { FactoryHalftoneField } from '../domains/auth/components/FactoryHalftoneField';
import '../domains/auth/components/sign-in-page.css';

/**
 * Only accept same-origin paths so a crafted `?returnTo=` can't bounce the
 * user to an external site after login. Prefix checks alone are not enough —
 * browsers normalize `/\host` to the protocol-relative `//host` — so the value
 * is resolved against the page origin and rejected when it leaves it.
 */
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

/**
 * Email/password credential form for the self-hosted better-auth provider.
 * Posts to the better-auth endpoints (which set the session cookie), then does
 * a full navigation to `returnTo` so the app boots with the fresh session.
 */
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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
      {mode === 'sign-up' ? (
        <label className="flex flex-col gap-2 text-sm font-medium text-neutral5">
          Name
          <Input
            type="text"
            size="lg"
            placeholder="Ada Lovelace"
            autoComplete="name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral5">
        Email
        <Input
          type="email"
          size="lg"
          placeholder="you@company.com"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral5">
        Password
        <Input
          type="password"
          size="lg"
          placeholder="Enter your password"
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </label>
      {error ? (
        <Txt as="p" variant="ui-sm" role="alert" className="text-accent2">
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
        <Txt as="p" variant="ui-sm" className="text-center text-neutral3">
          Account creation is managed by your administrator.
        </Txt>
      )}
    </form>
  );
}

/**
 * Dedicated `/signin` route rendered when web auth is enabled and the session
 * is unauthenticated. Provider-aware: hosted-login providers (WorkOS) get the
 * redirect button; the self-hosted better-auth provider gets an email/password
 * form. Both preserve where the user was headed via `?returnTo=`.
 */
export function SignInPage() {
  const { baseUrl } = useApiConfig();
  const auth = useFactoryAuth();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const returnTo = safeReturnTo(searchParams.get('returnTo')?.toString());
  const credentialForm = auth.data?.provider === 'better-auth';
  const studioAuth = auth.data?.provider === 'mastra-studio';
  const hostedLoginLabel = studioAuth ? 'Sign in with Mastra Platform' : 'Continue with GitHub';
  const hostedLoginPendingLabel = studioAuth ? 'Opening Mastra Platform…' : 'Opening GitHub…';

  // Mirror of the root auth guard: signed-in (or auth-disabled) visitors have
  // nothing to do here, so send them to their destination (or the root landing
  // when returnTo is absent/unsafe).
  if (!auth.isPending && (!auth.data?.authEnabled || auth.data.authenticated)) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <main className="factory-signin-theme min-h-dvh bg-surface1 font-mona-sans text-neutral6">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 px-6 sm:px-10 lg:grid-cols-[minmax(380px,0.82fr)_minmax(540px,1.18fr)]">
        <section className="relative z-3 flex max-w-xl flex-col justify-center py-11 lg:py-17">
          <h1 className="max-w-xl text-[clamp(2.625rem,5.3vw,4.25rem)] leading-[1.1] font-[520] tracking-[0.015em] text-balance [font-stretch:112%]">
            Build with an agent factory
          </h1>
          <Txt
            as="p"
            variant="ui-lg"
            className="mt-6 max-w-lg text-[clamp(1.0625rem,1.65vw,1.375rem)] leading-[1.36] tracking-[0.015em] text-neutral3"
          >
            Turn a repository into a working factory. Agents pick up scoped work, collaborate, and ship changes you can
            review.
          </Txt>

          <section aria-label="Authentication" className="mt-10 w-full max-w-md lg:mt-12">
            {credentialForm ? (
              <>
                <div className="mb-6">
                  <h2 className="font-display text-2xl font-medium">Welcome back</h2>
                  <Txt as="p" variant="ui-md" className="mt-2 leading-6 text-neutral3">
                    Sign in to continue building with your team.
                  </Txt>
                </div>
                <CredentialSignInForm returnTo={returnTo} signUpDisabled={auth.data?.signUpDisabled === true} />
              </>
            ) : (
              <Button
                variant="default"
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
