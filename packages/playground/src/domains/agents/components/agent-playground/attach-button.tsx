import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { Paperclip } from 'lucide-react';

export const ATTACH_BUTTON_SHORTCUT = 'a';

interface AttachButtonProps {
  tooltip: string;
  onClick: () => void;
}

/** "Attach" action bound to `A`. Mount at most one per view. */
export function AttachButton({ tooltip, onClick }: AttachButtonProps) {
  useKeydown({ [ATTACH_BUTTON_SHORTCUT]: onClick });

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      icon={<Paperclip />}
      tooltip={
        <span className="inline-flex items-center gap-1.5">
          {tooltip}
          <Kbd size="xs">A</Kbd>
        </span>
      }
      onClick={onClick}
    >
      Attach
    </Button>
  );
}
