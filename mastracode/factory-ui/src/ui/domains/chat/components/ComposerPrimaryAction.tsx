import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowUp, Square } from 'lucide-react';

interface ComposerPrimaryActionProps {
  showAbort: boolean;
  sendDisabled: boolean;
  sendTitle?: string;
  onAbort: () => void;
}

export function ComposerPrimaryAction({ showAbort, sendDisabled, sendTitle, onAbort }: ComposerPrimaryActionProps) {
  if (showAbort) {
    return (
      <Button
        type="button"
        size="icon-sm"
        onClick={event => {
          // Send turns into Abort under the pointer: a double-click on Send must not abort.
          if (event.detail > 1) return;
          onAbort();
        }}
        aria-label="Abort"
      >
        <Square size={14} />
      </Button>
    );
  }

  return (
    <Button type="submit" size="icon-sm" disabled={sendDisabled} aria-label="Send message" title={sendTitle}>
      <ArrowUp size={16} />
    </Button>
  );
}
