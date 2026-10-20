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
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { usePendingConnect } from '@mastra/playground-ui/domains/connect';
import type { UserConnectProvider } from '@mastra/playground-ui/domains/connect';
import { useEffect, useState } from 'react';
import { ProviderLogo } from './provider-logo';

export interface AddConnectionDialogProps {
  providers: UserConnectProvider[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable provider picker that drives the platform-hosted auth flow: pick a
 * provider, a connect session is created and the popup opens (inside the click
 * gesture so blockers allow it), then the connection status is polled until it
 * settles. Success closes the dialog; abandoned or failed flows offer a retry.
 */
export function AddConnectionDialog({ providers, open, onOpenChange }: AddConnectionDialogProps) {
  const { pending, connect, settled, isCreating, createError } = usePendingConnect();
  // The provider the user picked in this dialog session; the hook's outcome
  // only drives this dialog when it belongs to this attempt.
  const [attempt, setAttempt] = useState<UserConnectProvider | null>(null);

  const failureMessage = attempt
    ? (createError?.message ??
      (settled?.provider === attempt.id && settled.status === 'failed'
        ? 'The connection was not completed. Close the provider window and try again.'
        : null))
    : null;

  const succeeded = Boolean(attempt && settled?.provider === attempt.id && settled.status === 'active');

  // Closing the dialog is an imperative parent callback, so it runs in an
  // effect once the flow settles active. `attempt` is cleared on close, which
  // keeps a stale outcome from instantly closing a reopened dialog.
  useEffect(() => {
    if (open && succeeded) onOpenChange(false);
  }, [open, succeeded, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setAttempt(null);
    onOpenChange(nextOpen);
  };

  const startConnect = (provider: UserConnectProvider) => {
    setAttempt(provider);
    connect(provider);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>
            {attempt
              ? `Authorize ${attempt.displayName ?? attempt.id} to link it to your account.`
              : 'Connect one of your own accounts to this project.'}
          </DialogDescription>
        </DialogHeader>

        {!attempt ? (
          <DialogBody layout="fill" flush>
            <Command className="bg-transparent">
              <CommandInput placeholder="Search providers" />
              <CommandList scrollArea className="max-h-72">
                <CommandEmpty>No providers match your search.</CommandEmpty>
                {providers.map(provider => (
                  <CommandItem
                    key={provider.id}
                    value={provider.displayName ?? provider.id}
                    onSelect={() => startConnect(provider)}
                  >
                    <ProviderLogo logoUrl={provider.logoUrl} />
                    {provider.displayName ?? provider.id}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </DialogBody>
        ) : failureMessage ? (
          <>
            <DialogBody>
              <Notice variant="destructive" title="Couldn't connect">
                {failureMessage}
              </Notice>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAttempt(null)}>
                Back
              </Button>
              <Button variant="default" onClick={() => startConnect(attempt)}>
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
