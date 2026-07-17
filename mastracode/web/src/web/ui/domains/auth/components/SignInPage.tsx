import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { useWebAuth } from '../../../../../shared/hooks/useWebAuth';
import { Wordmark } from '../../../ui';
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
    <form onSubmit={handleSubmit} className="flex w-64 flex-col gap-3">
      {mode === 'sign-up' ? (
        <Input
          type="text"
          size="sm"
          placeholder="Name"
          aria-label="Name"
          autoComplete="name"
          required
          value={name}
          onChange={e => setName(e.target.value)}
        />
      ) : null}
      <Input
        type="email"
        size="sm"
        placeholder="Email"
        aria-label="Email"
        autoComplete="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <Input
        type="password"
        size="sm"
        placeholder="Password"
        aria-label="Password"
        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
        required
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {error ? (
        <Txt as="p" variant="ui-sm" role="alert" className="text-accent2">
          {error}
        </Txt>
      ) : null}
      <Button type="submit" variant="default" size="sm" disabled={pending}>
        {mode === 'sign-up' ? 'Sign up' : 'Sign in'}
      </Button>
      {!signUpDisabled ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setError(null);
            setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up');
          }}
        >
          {mode === 'sign-up' ? 'Have an account? Sign in' : 'New here? Sign up'}
        </Button>
      ) : null}
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
  const auth = useWebAuth();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo')?.toString());
  const credentialForm = auth.data?.provider === 'better-auth';

  return (
    <main className="grid h-dvh place-items-center">
      <div className="flex flex-col items-center gap-6">
        <Wordmark brand="factory" />
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Sign in to continue
        </Txt>
        {credentialForm ? (
          <CredentialSignInForm returnTo={returnTo} signUpDisabled={auth.data?.signUpDisabled === true} />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => redirectToLogin(baseUrl, returnTo)}>
            Sign in
          </Button>
        )}
      </div>
    </main>
  );
}
