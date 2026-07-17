import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { OAuthStartResponse } from '../../../../../shared/api/types';
import { useCompleteProviderOAuth, usePollProviderOAuth } from '../../../../../shared/hooks/use-providers';

interface ProviderOAuthDialogProps {
  provider: string;
  session: OAuthStartResponse;
  onClose: () => void;
  onComplete: () => void;
}

export function ProviderOAuthDialog({ provider, session, onClose, onComplete }: ProviderOAuthDialogProps) {
  if (session.kind === 'paste-code') {
    return <PasteCodeDialog provider={provider} session={session} onClose={onClose} onComplete={onComplete} />;
  }

  return <DeviceCodeDialog provider={provider} session={session} onClose={onClose} onComplete={onComplete} />;
}

function openAuthorizationUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function PasteCodeDialog({ provider, session, onClose, onComplete }: ProviderOAuthDialogProps) {
  const completeMutation = useCompleteProviderOAuth();
  const [code, setCode] = useState('');

  const complete = async () => {
    const authorizationCode = code.trim();
    if (!authorizationCode) return;
    try {
      await completeMutation.mutateAsync({ provider, sessionId: session.sessionId, code: authorizationCode });
      onComplete();
    } catch {
      // Mutation error is rendered below.
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to {provider}</DialogTitle>
          <DialogDescription>Authorize your account and paste the returned code.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Txt as="p" variant="ui-sm" className="text-icon4">
            {session.instructions}
          </Txt>
          <Button variant="outline" onClick={() => openAuthorizationUrl(session.url)}>
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
            <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
              {completeMutation.error.message}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!code.trim() || completeMutation.isPending}
            onClick={() => void complete()}
          >
            {completeMutation.isPending ? 'Completing…' : 'Complete sign in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceCodeDialog({ provider, session, onClose, onComplete }: ProviderOAuthDialogProps) {
  const pollMutation = usePollProviderOAuth();
  const [nextPollAt, setNextPollAt] = useState(() => Date.now() + (session.nextPollMs ?? 1000));
  const [flowError, setFlowError] = useState<string>();

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        pollMutation.mutate(
          { provider, sessionId: session.sessionId },
          {
            onSuccess: response => {
              if (response.status === 'complete') {
                onComplete();
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
  }, [nextPollAt, onComplete, pollMutation, provider, session.sessionId]);

  const copyCode = async () => {
    if (session.userCode) await navigator.clipboard.writeText(session.userCode);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to {provider}</DialogTitle>
          <DialogDescription>Enter the device code on the provider authorization page.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Txt as="p" variant="ui-sm" className="text-icon4">
            {session.instructions}
          </Txt>
          {session.userCode && (
            <div className="flex items-center justify-between gap-3">
              <Badge size="md" variant="info">
                {session.userCode}
              </Badge>
              <Button size="sm" onClick={() => void copyCode()}>
                <Copy />
                Copy code
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={() => openAuthorizationUrl(session.url)}>
            <ExternalLink />
            Open authorization page
          </Button>
          {flowError ? (
            <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
              {flowError}
            </Txt>
          ) : (
            <div className="flex items-center gap-2 text-icon4" role="status">
              <Loader2 size={14} className="motion-safe:animate-spin motion-reduce:animate-none" />
              <Txt as="span" variant="ui-sm">
                Waiting for authorization…
              </Txt>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
