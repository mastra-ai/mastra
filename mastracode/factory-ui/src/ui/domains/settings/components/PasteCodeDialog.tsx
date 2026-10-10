import { Button } from '@mastra/playground-ui/components/Button';
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
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import type { ProviderOAuthDialogProps } from './ProviderOAuthDialog';
import { useCompleteProviderOAuth } from '../../../../hooks/use-providers';
import { providerDisplayName } from './provider-display-name';

function openAuthorizationUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function PasteCodeDialog({ provider, session, onClose, onComplete, scopeNotice }: ProviderOAuthDialogProps) {
  const displayName = providerDisplayName(provider);
  const completeMutation = useCompleteProviderOAuth();
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
          <Button onClick={() => openAuthorizationUrl(session.url)}>
            <ExternalLink />
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
          <DialogAction disabled={!code.trim()} onConfirm={() => void complete()}>
            {completeMutation.isPending ? 'Completing…' : 'Complete sign in'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
