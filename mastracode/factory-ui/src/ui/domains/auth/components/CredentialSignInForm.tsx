import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useApiConfig } from '../../../../api/config';
import { navigateAfterSignIn, signInWithPassword, signUpWithPassword } from '../services/auth';

export function CredentialSignInForm({ returnTo, signUpDisabled }: { returnTo: string; signUpDisabled: boolean }) {
  const { baseUrl } = useApiConfig();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
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

  const submitLabel = mode === 'sign-up' ? 'Create account' : 'Sign in';

  return (
    <>
      <div className="mb-6">
        <Txt font="display" as="h2" variant="title">
          Welcome back
        </Txt>
        <Txt as="p" variant="body" tone="muted" className="mt-2">
          Sign in to continue building with your team.
        </Txt>
      </div>
      <Form onSubmit={handleSubmit} className="w-full gap-5">
        {mode === 'sign-up' && (
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
        )}
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
        {error && (
          <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
            {error}
          </Txt>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Please wait…' : submitLabel}
        </Button>
        {!signUpDisabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-center"
            onClick={() => {
              setError(undefined);
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
    </>
  );
}
