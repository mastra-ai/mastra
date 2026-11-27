import { useMutation } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useState } from 'react';
import { providerDisplayName } from './model-picker-catalog';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Input } from '@/ds/components/Input';

import { Txt } from '@/ds/components/Txt';
import { IconLoadingCircle } from '@/ds/icons/central/IconLoadingCircle';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';

export interface OAuthStartResponse {
  sessionId: string;
  kind: 'paste-code' | 'device-code';
  url: string;
  userCode?: string;
  instructions: string;
  expiresAt: number;
  nextPollMs?: number;
}

export type OAuthPollResponse =
  | { status: 'pending'; nextPollMs: number }
  | { status: 'complete' }
  | { status: 'failed'; error: string };

/** Completes a sign-in: `complete` sends a pasted code, `poll` checks a device-code sign-in. */
export interface ProviderOAuthActions {
  complete: (args: { provider: string; sessionId: string; code: string }) => Promise<unknown>;
  poll: (args: { provider: string; sessionId: string }) => Promise<OAuthPollResponse>;
}

export interface ProviderOAuthDialogProps {
  provider: string;
  session: OAuthStartResponse;
  actions: ProviderOAuthActions;
  scopeNotice?: string;
  onClose: () => void;
  onComplete: () => void;
}

export function ProviderOAuthDialog(props: ProviderOAuthDialogProps) {
  if (props.session.kind === 'paste-code') {
    return <PasteCodeDialog {...props} />;
  }

  return <DeviceCodeDialog {...props} />;
}

function openAuthorizationUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function PasteCodeDialog({ provider, session, actions, onClose, onComplete, scopeNotice }: ProviderOAuthDialogProps) {
  const displayName = providerDisplayName(provider);
  const completeMutation = useMutation({ mutationFn: actions.complete });
  const [code, setCode] = useState('');

  const complete = async () => {
    const authorizationCode = code.trim();
    if (!authorizationCode || completeMutation.isPending) return;
    try {
      await completeMutation.mutateAsync({ provider, sessionId: session.sessionId, code: authorizationCode });
      onComplete();
    } catch {}
  };

  const close = () => {
    if (!completeMutation.isPending) onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && close()} pending={completeMutation.isPending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to {displayName}</DialogTitle>
          <DialogDescription>{scopeNotice ?? 'Authorize your account and paste the returned code.'}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Txt as="p" variant="caption" tone="muted">
            {session.instructions}
          </Txt>
          <Button icon={<IconSquareArrowTopRight />} onClick={() => openAuthorizationUrl(session.url)}>
            Open authorization page
          </Button>
          <Input
            autoFocus
            aria-label="Authorization code"
            placeholder="Paste authorization code"
            value={code}
            disabled={completeMutation.isPending}
            onChange={event => setCode(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void complete();
            }}
          />
          {completeMutation.error instanceof Error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {completeMutation.error.message}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!code.trim()} onConfirm={() => void complete()} loading={completeMutation.isPending}>
            Complete sign in
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceCodeDialog({ provider, session, actions, onClose, onComplete, scopeNotice }: ProviderOAuthDialogProps) {
  const displayName = providerDisplayName(provider);
  const pollMutation = useMutation({ mutationFn: actions.poll });
  const { mutate: poll } = pollMutation;
  const completeSignIn = useEffectEvent(() => onComplete());
  const [nextPollAt, setNextPollAt] = useState(() => Date.now() + (session.nextPollMs ?? 1000));
  const [flowError, setFlowError] = useState<string>();

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        poll(
          { provider, sessionId: session.sessionId },
          {
            onSuccess: response => {
              if (response.status === 'complete') {
                completeSignIn();
                return;
              }
              if (response.status === 'failed') {
                setFlowError(response.error);
                return;
              }
              setNextPollAt(Date.now() + response.nextPollMs);
            },
            onError: error => setFlowError(error instanceof Error ? error.message : String(error)),
          },
        );
      },
      Math.max(0, nextPollAt - Date.now()),
    );

    return () => window.clearTimeout(timer);
  }, [nextPollAt, poll, provider, session.sessionId]);

  const close = () => {
    if (!pollMutation.isPending) onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && close()}>
      <DialogContent>
        <DialogHeader className="items-center text-center">
          <DialogTitle>Sign in to {displayName}</DialogTitle>
          <DialogDescription>
            {scopeNotice ?? 'Enter the device code on the provider authorization page.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="items-center text-center">
          {session.userCode && (
            <div className="flex w-full min-w-0 items-center justify-center gap-2">
              <Txt
                as="span"
                variant="title"
                font="mono"
                className="min-w-0 flex-1 tracking-widest break-all select-all"
              >
                {session.userCode}
              </Txt>
              <CopyButton content={session.userCode} variant="ghost" size="icon-sm" tooltip="Copy code" />
            </div>
          )}
          <Button
            icon={<IconSquareArrowTopRight />}
            className="w-full"
            onClick={() => openAuthorizationUrl(session.url)}
          >
            Open authorization page
          </Button>
        </DialogBody>
        <DialogFooter>
          {flowError ? (
            <Txt
              as="p"
              variant="caption"
              className="mr-auto min-w-0 break-words text-destructive-foreground"
              role="alert"
            >
              {flowError}
            </Txt>
          ) : (
            <div className="mr-auto flex items-center gap-2 text-muted-foreground" role="status">
              <IconLoadingCircle className="size-icon-sm motion-safe:animate-spin motion-reduce:animate-none" />
              <Txt as="span" variant="caption">
                Waiting for authorization…
              </Txt>
            </div>
          )}
          <DialogCancel disabled={pollMutation.isPending}>Cancel</DialogCancel>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
