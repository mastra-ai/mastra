import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { TriangleAlert } from 'lucide-react';

import { FLOAT_IN } from './CanvasChrome';

/**
 * The pill over the toolbar while there are unsaved edits, with Discard and Save. When the save is held, the label
 * says what to fix first.
 */
export function UnsavedPill({
  label,
  held = false,
  saveLabel,
  saving,
  onSave,
  onDiscard,
}: {
  label: string;
  /** Something must be fixed before saving: the label shows a warning and Save is off. */
  held?: boolean;
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className={cn('bg-card shadow-overlay flex h-10 items-center gap-1 rounded-full pr-1 pl-3.5', FLOAT_IN)}>
      {held ? (
        <TriangleAlert className="text-warning-indicator size-icon-xs shrink-0" aria-hidden />
      ) : (
        <span className="bg-foreground size-1.75 shrink-0 rounded-full" aria-hidden />
      )}
      <Txt as="span" variant="body-sm" tone="ink" role="status" className="ml-1 pr-1.5">
        {label}
      </Txt>
      <Button size="sm" variant="ghost" disabled={saving} onClick={onDiscard}>
        Discard
      </Button>
      <Button size="sm" variant="primary" disabled={held} loading={saving} onClick={onSave}>
        {saveLabel}
      </Button>
    </div>
  );
}
