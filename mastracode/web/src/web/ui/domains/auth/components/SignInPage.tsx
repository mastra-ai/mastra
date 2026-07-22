import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { useFactoryAuth } from '../../../../../shared/hooks/useFactoryAuth';
import { navigateAfterSignIn, redirectToLogin, signInWithPassword, signUpWithPassword } from '../services/auth';

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

  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface1 text-neutral6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklab,var(--accent1)_15%,transparent),transparent_32%),radial-gradient(circle_at_85%_80%,color-mix(in_oklab,var(--accent3)_12%,transparent),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border1)_1px,transparent_1px),linear-gradient(to_bottom,var(--border1)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="absolute top-[-12rem] left-1/2 h-[28rem] w-[42rem] -translate-x-1/2 rounded-full bg-accent1/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl items-center px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
        <section className="flex w-full max-w-4xl flex-col items-start">
          <div className="mb-12 flex items-center gap-3" aria-label="Mastra Factory">
            <LogoWithoutText className="w-9 text-accent1" aria-hidden="true" />
            <span className="text-lg font-semibold tracking-tight">Mastra Factory</span>
          </div>

          <Txt as="p" variant="ui-md" className="mb-5 font-medium tracking-wide text-accent1 uppercase">
            From backlog to production
          </Txt>
          <h1 className="max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
            Turn issues into production-ready code.
          </h1>
          <Txt as="p" variant="ui-lg" className="mt-7 max-w-2xl leading-7 text-neutral3 sm:text-lg">
            Mastra Factory turns work from GitHub Issues, Linear, and other trackers into reviewed pull requests that
            are ready to merge and ship.
          </Txt>

          <section aria-label="Authentication" className="mt-10 w-full max-w-md">
            {credentialForm ? (
              <>
                <div className="mb-7">
                  <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
                  <Txt as="p" variant="ui-md" className="mt-2 leading-6 text-neutral3">
                    Sign in to continue building with your team.
                  </Txt>
                </div>
                <CredentialSignInForm returnTo={returnTo} signUpDisabled={auth.data?.signUpDisabled === true} />
              </>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="min-h-14 w-fit text-base"
                disabled={redirecting || auth.isPending}
                onClick={() => {
                  setRedirecting(true);
                  redirectToLogin(baseUrl, returnTo);
                }}
              >
                <GithubIcon aria-hidden="true" />
                {redirecting ? 'Opening GitHub…' : 'Continue with GitHub'}
              </Button>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
