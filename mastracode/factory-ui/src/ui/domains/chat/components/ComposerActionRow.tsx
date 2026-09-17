import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  ComposerActions,
  ComposerAttachmentButton,
  ComposerSendButton,
  ComposerStopButton,
} from '@mastra/playground-ui/components/Composer';
import type { ReactNode } from 'react';

interface ComposerActionRowProps {
  children: ReactNode;
  attachDisabled?: boolean;
  sendDisabled: boolean;
  sendTitle?: string;
  onAttach: () => void;
  onAbort?: () => void;
}

export function ComposerActionRow({
  children,
  attachDisabled,
  sendDisabled,
  sendTitle,
  onAttach,
  onAbort,
}: ComposerActionRowProps) {
  return (
    <ComposerActions>
      {children}
      <ButtonsGroup className="ml-auto" spacing="close" aria-label="Composer actions">
        <ComposerAttachmentButton
          appearance="outline"
          disabled={attachDisabled}
          onClick={onAttach}
          aria-label="Attach image"
        />
        {onAbort && <ComposerStopButton appearance="outline" onClick={onAbort} aria-label="Abort" />}
        <ComposerSendButton appearance="outline" disabled={sendDisabled} aria-label="Send message" title={sendTitle} />
      </ButtonsGroup>
    </ComposerActions>
  );
}
