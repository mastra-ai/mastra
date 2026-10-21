import { SaveIcon } from 'lucide-react';
import type { SavedViewsController } from './use-saved-views';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';

export type SavedViewUnsavedDialogProps<TState> = {
  /** The views whose active one has unsaved changes. */
  views: SavedViewsController<TState>;
  /** A switch or a page leave is waiting on the user. */
  open: boolean;
  /** Carries on, once the changes were saved to the view or discarded. */
  onProceed: () => void;
  /** Stays on the view with its changes. */
  onCancel: () => void;
};

/** Asked before leaving a view that has unsaved changes: switching views, or leaving the page. */
export function SavedViewUnsavedDialog<TState>({
  views,
  open,
  onProceed,
  onCancel,
}: SavedViewUnsavedDialogProps<TState>) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={next => {
        if (!next) onCancel();
      }}
    >
      {/* Wide enough for its three actions on one row. */}
      <AlertDialog.Content size="md">
        <AlertDialog.Header>
          <AlertDialog.Title>Unsaved changes to “{views.activeView?.name}”</AlertDialog.Title>
          <AlertDialog.Description>Leaving this view discards them.</AlertDialog.Description>
        </AlertDialog.Header>
        {views.error && (
          <AlertDialog.Body>
            <Txt role="alert" variant="caption" className="text-destructive-foreground">
              {views.error}
            </Txt>
          </AlertDialog.Body>
        )}
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <Button disabled={views.pending} onClick={onProceed}>
            Discard changes
          </Button>
          <Button
            icon={<SaveIcon />}
            variant="primary"
            disabled={views.pending}
            onClick={() => views.save({ onSaved: onProceed })}
          >
            Save to this view
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
