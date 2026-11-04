import { Button } from '@mastra/playground-ui/components/Button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mastra/playground-ui/components/Command';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { UserConnectProvider } from '@mastra/playground-ui/domains/connect';
import {
  ProviderLogo,
  headlessAuthFieldKey,
  headlessAuthFields,
  headlessAuthRequiresForm,
  supportsHeadlessAuth,
  usePendingConnect,
} from '@mastra/playground-ui/domains/connect';
import { useEffect, useState } from 'react';

export interface AddConnectionDialogProps {
  providers: UserConnectProvider[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable provider picker that drives the add-connection flow. Providers
 * whose headless auth needs collected inputs (API key, Basic, two-step
 * credentials, flow params) get a form step first; everything else authorizes
 * immediately — headlessly through the provider's own popup when the launch
 * gate releases a session token, through the hosted popup otherwise. Success
 * closes the dialog; abandoned or failed flows offer a retry.
 */
export function AddConnectionDialog({ providers, open, onOpenChange }: AddConnectionDialogProps) {
  const { pending, connect, cancel, settled, isCreating, createError } = usePendingConnect();
  // The provider the user picked in this dialog session; the hook's outcome
  // only drives this dialog when it belongs to this attempt.
  const [attempt, setAttempt] = useState<UserConnectProvider | null>(null);
  // Whether the attempt is still collecting its fields (form step).
  const [collecting, setCollecting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const failureMessage = attempt
    ? (createError?.message ??
      (settled?.provider === attempt.id && settled.status === 'failed'
        ? (settled.message ?? 'The connection was not completed. Close the provider window and try again.')
        : null))
    : null;

  const succeeded = Boolean(attempt && settled?.provider === attempt.id && settled.status === 'active');

  // Closing the dialog is an imperative parent callback, so it runs in an
  // effect once the flow settles active. `attempt` is cleared on close, which
  // keeps a stale outcome from instantly closing a reopened dialog.
  useEffect(() => {
    if (open && succeeded) onOpenChange(false);
  }, [open, succeeded, onOpenChange]);

  const resetAttempt = () => {
    setAttempt(null);
    setCollecting(false);
    setValues({});
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Abandon an in-flight flow so it cannot settle a future attempt.
      cancel();
      resetAttempt();
    }
    onOpenChange(nextOpen);
  };

  const needsForm = (provider: UserConnectProvider) =>
    supportsHeadlessAuth(provider.authType, provider.authFields) && headlessAuthRequiresForm(provider);

  const startConnect = (provider: UserConnectProvider) => {
    setAttempt(provider);
    if (needsForm(provider)) {
      setCollecting(true);
      return;
    }
    connect(provider);
  };

  const fields = attempt && collecting ? headlessAuthFields(attempt) : [];
  const missingRequired = fields.some(field => !!field.required && !values[headlessAuthFieldKey(field)]?.trim());

  const submitForm = () => {
    if (!attempt) return;
    setCollecting(false);
    connect(attempt, values);
  };

  const retry = () => {
    if (!attempt) return;
    if (needsForm(attempt)) {
      // Rejected credentials go back to the form with the values kept.
      setCollecting(true);
      return;
    }
    startConnect(attempt);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>
            {attempt
              ? collecting
                ? `Enter the ${attempt.displayName ?? attempt.id} details to link it to your account.`
                : `Authorize ${attempt.displayName ?? attempt.id} to link it to your account.`
              : 'Connect one of your own accounts to this project.'}
          </DialogDescription>
        </DialogHeader>

        {!attempt ? (
          <DialogBody layout="fill" flush>
            <Command className="bg-transparent" loop label="Search providers">
              <CommandInput aria-label="Search providers" placeholder="Search providers" />
              <CommandList
                scrollArea
                scrollAreaMask
                scrollAreaClassName="h-[min(26rem,calc(100dvh-16rem))]"
                className="px-2 py-2"
              >
                <CommandEmpty>No providers match your search.</CommandEmpty>
                {providers.map(provider => (
                  <CommandItem
                    key={provider.id}
                    value={provider.displayName ?? provider.id}
                    onSelect={() => startConnect(provider)}
                  >
                    <ProviderLogo logoUrl={provider.logoUrl} />
                    <Txt as="span" variant="body-sm" tone="ink" className="min-w-0 truncate">
                      {provider.displayName ?? provider.id}
                    </Txt>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </DialogBody>
        ) : collecting ? (
          <>
            <DialogBody>
              <div className="space-y-4">
                {fields.map(field => {
                  const key = headlessAuthFieldKey(field);
                  return (
                    <Field key={key}>
                      <FieldLabel>{field.label ?? field.name}</FieldLabel>
                      <Input
                        type={field.secret ? 'password' : 'text'}
                        placeholder={field.placeholder ?? undefined}
                        value={values[key] ?? ''}
                        onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))}
                      />
                    </Field>
                  );
                })}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={resetAttempt}>
                Back
              </Button>
              <Button variant="primary" disabled={missingRequired} onClick={submitForm}>
                Connect
              </Button>
            </DialogFooter>
          </>
        ) : failureMessage ? (
          <>
            <DialogBody>
              <Notice variant="destructive" title="Couldn't connect">
                {failureMessage}
              </Notice>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={resetAttempt}>
                Back
              </Button>
              <Button variant="primary" onClick={retry}>
                Try again
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody>
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Spinner />
                <Txt as="p" variant="body">
                  Waiting for authorization
                </Txt>
                <Txt as="p" variant="body-sm" tone="muted">
                  Finish signing in to {attempt.displayName ?? attempt.id} in the provider window.
                </Txt>
                {pending?.provider === attempt.id && pending.fallbackUrl ? (
                  <a
                    href={pending.fallbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ui-md underline underline-offset-2"
                  >
                    Open the connect window
                  </a>
                ) : null}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" disabled={isCreating} onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
