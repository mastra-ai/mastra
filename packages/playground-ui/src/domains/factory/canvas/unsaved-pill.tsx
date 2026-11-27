import { TriangleAlert } from 'lucide-react';
import { FLOAT_IN } from './canvas-frame';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

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
    <div className={cn('flex h-10 items-center gap-1 rounded-full bg-card pr-1 pl-3.5 shadow-overlay', FLOAT_IN)}>
      {held ? (
        <TriangleAlert className="size-icon-xs shrink-0 text-warning-indicator" aria-hidden />
      ) : (
        <span className="size-1.75 shrink-0 rounded-full bg-foreground" aria-hidden />
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
