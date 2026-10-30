import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

export interface SaveBarProps {
  saving: boolean;
  /** Why Save is blocked, shown next to the label instead of a mute grey button. */
  problem?: string;
  onDiscard: () => void;
  onSave: () => void;
}

export function SaveBar({ saving, problem, onDiscard, onSave }: SaveBarProps) {
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="label">
          Unsaved changes
        </Txt>
        {problem ? (
          <Txt as="span" variant="caption" tone="muted">
            {problem}
          </Txt>
        ) : null}
      </span>
      <Button size="sm" variant="ghost" disabled={saving} onClick={onDiscard}>
        Discard
      </Button>
      <Button size="sm" variant="primary" disabled={saving || problem !== undefined} onClick={onSave}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
