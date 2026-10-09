import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
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
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { OAuthStartResponse } from '../../../../api/types';
import { useCompleteProviderOAuth, usePollProviderOAuth } from '../../../../hooks/use-providers';
import { providerDisplayName } from './provider-display-name';

interface ProviderOAuthDialogProps {
  provider: string;
  session: OAuthStartResponse;
  scopeNotice?: string;
  onClose: () => void;
  onComplete: () => void;
}

export function ProviderOAuthDialog({ provider, session, onClose, onComplete, scopeNotice }: ProviderOAuthDialogProps) {
  if (session.kind === 'paste-code') {
    return (
      <PasteCodeDialog
        provider={provider}
        session={session}
        onClose={onClose}
        onComplete={onComplete}
        scopeNotice={scopeNotice}
      />
    );
  }

  return (
    <DeviceCodeDialog
      provider={provider}
      session={session}
      onClose={onClose}
      onComplete={onComplete}
      scopeNotice={scopeNotice}
    />
  );
}

function openAuthorizationUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function PasteCodeDialog({ provider, session, onClose, onComplete, scopeNotice }: ProviderOAuthDialogProps) {
  const displayName = providerDisplayName(provider);
  const completeMutation = useCompleteProviderOAuth();
  const [code, setCode] = useState('');

  const complete = async () => {
    const authorizationCode = code.trim();
    if (!authorizationCode) return;
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
          <Button onClick={() => openAuthorizationUrl(session.url)}>
            <ExternalLink />
            Open authorization page
          </Button>
          <Input
            autoFocus
            aria-label="Authorization code"
            placeholder="Paste authorization code"
            value={code}
            onChange={event => setCode(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void complete();
            }}
          />
          {completeMutation.error instanceof Error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground">
              {completeMutation.error.message}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!code.trim()} onConfirm={() => void complete()}>
            {completeMutation.isPending ? 'Completing…' : 'Complete sign in'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceCodeDialog({ provider, session, onClose, onComplete, scopeNotice }: ProviderOAuthDialogProps) {
  const displayName = providerDisplayName(provider);
  const pollMutation = usePollProviderOAuth();
  const { mutate: poll } = pollMutation;
  const onCompleteRef = useRef(onComplete);
  const [nextPollAt, setNextPollAt] = useState(() => Date.now() + (session.nextPollMs ?? 1000));
  const [flowError, setFlowError] = useState<string>();

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        poll(
          { provider, sessionId: session.sessionId },
          {
            onSuccess: response => {
              if (response.status === 'complete') {
                onCompleteRef.current();
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
          <Button className="w-full" onClick={() => openAuthorizationUrl(session.url)}>
            <ExternalLink />
            Open authorization page
          </Button>
        </DialogBody>
        <DialogFooter>
          {flowError ? (
            <Txt as="p" variant="caption" className="text-destructive-foreground mr-auto min-w-0 break-words">
              {flowError}
            </Txt>
          ) : (
            <div className="text-muted-foreground mr-auto flex items-center gap-2" role="status">
              <Loader2 size={14} className="motion-safe:animate-spin motion-reduce:animate-none" />
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
