import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router';

import { useCredentialRequest, useSubmitCredential } from '../../hooks/use-credential-request';

const HOUR = 60 * 60 * 1000;
const TTL_OPTIONS = [1, 4, 24].map(hours => hours * HOUR);

/**
 * Private entry for a credential an agent asked for. Opened from a one-time link, only by the session
 * owner; the value goes straight into the POST body and is never shown again.
 */
export function CredentialRequestPage() {
  const { requestId = '' } = useParams();
  const query = useCredentialRequest(requestId);
  const submit = useSubmitCredential(requestId);
  const [value, setValue] = useState('');
  const [ttlMs, setTtlMs] = useState<number | null>(null);
  const [allowSandbox, setAllowSandbox] = useState(true);

  const data = query.data;
  const effectiveTtl = ttlMs ?? data?.defaultTtlMs ?? 4 * HOUR;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    submit.mutate({ value, ttlMs: effectiveTtl, allowSandbox }, { onSettled: () => setValue('') });
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <Txt as="h1" variant="heading">
        Provide a credential
      </Txt>
      {query.isPending ? (
        <Txt variant="body-sm">Loading…</Txt>
      ) : query.isError || !data ? (
        <Txt variant="body-sm">This credential request does not exist or is not yours.</Txt>
      ) : submit.isSuccess || data.request.status === 'fulfilled' ? (
        <Txt variant="body-sm">
          {data.request.name} was saved. The agent has been told it is available; you can close this page.
        </Txt>
      ) : data.request.status === 'expired' ? (
        <Txt variant="body-sm">This link has expired. Ask the agent to request the credential again.</Txt>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit} autoComplete="off">
          <Txt variant="body-sm">
            An agent in {data.session?.title ? `“${data.session.title}”` : 'your session'} asked for{' '}
            <code>{data.request.name}</code>: {data.request.purpose}
          </Txt>
          <div className="border-border1 rounded-md border p-3">
            <Txt variant="body-sm">
              Only use a short-lived, least-privilege test credential. When passed to a command, the value is placed in
              that command&apos;s environment inside the sandbox, so code running there can read or send it elsewhere.
              Output redaction is best-effort. Revoke it when you are done.
            </Txt>
          </div>
          <Field className="gap-1">
            <FieldLabel>Value</FieldLabel>
            <Input
              type="password"
              size="sm"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={event => setValue(event.target.value)}
            />
          </Field>
          <Field className="gap-1">
            <FieldLabel>Expires after</FieldLabel>
            <select
              className="border-border1 rounded-md border bg-transparent p-1 text-sm"
              value={effectiveTtl}
              onChange={event => setTtlMs(Number(event.target.value))}
            >
              {TTL_OPTIONS.filter(ms => ms <= data.maxTtlMs).map(ms => (
                <option key={ms} value={ms}>
                  {ms / HOUR} hour{ms === HOUR ? '' : 's'}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowSandbox} onChange={event => setAllowSandbox(event.target.checked)} />
            <Txt variant="body-sm">Allow the agent to pass it to commands in its sandbox</Txt>
          </label>
          {submit.isError && <Txt variant="body-sm">{submit.error.message}</Txt>}
          <Button type="submit" disabled={!value || submit.isPending}>
            Save credential
          </Button>
        </form>
      )}
    </main>
  );
}
