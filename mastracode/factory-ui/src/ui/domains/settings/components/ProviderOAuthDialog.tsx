import type { OAuthStartResponse } from '../../../../api/types';
import { PasteCodeDialog } from './PasteCodeDialog';
import { DeviceCodeDialog } from './DeviceCodeDialog';

export interface ProviderOAuthDialogProps {
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
        key={session.sessionId}
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
      key={session.sessionId}
      provider={provider}
      session={session}
      onClose={onClose}
      onComplete={onComplete}
      scopeNotice={scopeNotice}
    />
  );
}
