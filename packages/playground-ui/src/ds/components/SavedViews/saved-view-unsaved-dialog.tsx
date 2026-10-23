import { useEffect, useState } from 'react';
import type { SavedViewsController } from './use-saved-views';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';

export type SavedViewUnsavedDialogProps<TSettings> = {
  /** The views whose draft would be dropped. */
  views: SavedViewsController<TSettings>;
  /** A switch or a page leave is waiting on the user. */
  open: boolean;
  /** Carries on, once the draft was saved or discarded. */
  onProceed: () => void;
  /** Stays on the view with its changes. */
  onCancel: () => void;
};

/** Asked before dropping a draft with unsaved changes: switching views, or leaving the page. */
export function SavedViewUnsavedDialog<TSettings>({
  views,
  open,
  onProceed,
  onCancel,
}: SavedViewUnsavedDialogProps<TSettings>) {
  const [saveSettled, setSaveSettled] = useState(false);
  // A failed save keeps the draft and reports through `storageError`, so carry on only once the draft is saved.
  useEffect(() => {
    if (!saveSettled) return;
    setSaveSettled(false);
    if (!views.unsaved) onProceed();
  }, [saveSettled, views.unsaved, onProceed]);

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
          <AlertDialog.Title>Unsaved changes to “{views.draft?.name ?? views.activeView?.name}”</AlertDialog.Title>
          <AlertDialog.Description>Leaving this view discards them.</AlertDialog.Description>
        </AlertDialog.Header>
        {views.storageError && (
          <AlertDialog.Body>
            <Txt role="alert" variant="caption" className="text-destructive-foreground">
              {views.storageError}
            </Txt>
          </AlertDialog.Body>
        )}
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <Button
            disabled={views.pending}
            onClick={() => {
              views.discard();
              onProceed();
            }}
          >
            Discard changes
          </Button>
          <Button
            variant="primary"
            disabled={views.pending}
            onClick={async () => {
              await views.save();
              setSaveSettled(true);
            }}
          >
            {views.draft?.viewId === undefined ? 'Save view' : 'Save changes'}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
