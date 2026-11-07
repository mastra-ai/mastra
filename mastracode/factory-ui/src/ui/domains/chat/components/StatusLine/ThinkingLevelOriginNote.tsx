import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

interface ThinkingLevelOriginNoteProps {
  source: string;
  setForSession: boolean;
  onUseDefault: () => void;
}

export function ThinkingLevelOriginNote({ source, setForSession, onUseDefault }: ThinkingLevelOriginNoteProps) {
  if (!setForSession) {
    return (
      <Txt as="p" variant="caption" tone="muted">
        Follows the {source}.
      </Txt>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <Txt as="p" variant="caption" tone="muted">
        Set for this session.
      </Txt>
      <Button variant="ghost" size="sm" onClick={onUseDefault}>
        Use default
      </Button>
    </div>
  );
}
