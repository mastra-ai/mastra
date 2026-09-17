import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { ComposerSendButton, ComposerStopButton } from '@mastra/playground-ui/components/Composer';
import type { ReactNode } from 'react';

interface ComposerActionRowProps {
  controls?: ReactNode;
  children?: ReactNode;
  canExecute?: boolean;
  isEmpty: boolean;
  isRunning: boolean;
  canSendWhileStreaming: boolean;
  onCancel: () => void;
}

export function ComposerActionRow({
  controls,
  children,
  canExecute = true,
  isEmpty,
  isRunning,
  canSendWhileStreaming,
  onCancel,
}: ComposerActionRowProps) {
  return (
    <>
      {controls && <div className="flex max-w-full shrink-0 items-center gap-1.5">{controls}</div>}
      <div className="flex shrink-0 items-center gap-1.5">
        <ButtonsGroup spacing="close">{canExecute && children}</ButtonsGroup>
        {(!isRunning || canSendWhileStreaming) && (
          <ComposerSendButton
            tooltip={canExecute ? 'Send' : 'No permission to execute'}
            disabled={!canExecute || isEmpty}
          />
        )}
        {isRunning && <ComposerStopButton tooltip="Cancel" onClick={onCancel} />}
      </div>
    </>
  );
}
