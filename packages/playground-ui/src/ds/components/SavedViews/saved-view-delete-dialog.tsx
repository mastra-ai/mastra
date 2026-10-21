import { Trash2Icon } from 'lucide-react';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button/Button';

export function SavedViewDeleteDialog({
  viewName,
  onConfirm,
  onClose,
}: {
  /** The view to delete; the dialog is closed while this is `undefined`. */
  viewName: string | undefined;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open={viewName !== undefined}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete view?</AlertDialog.Title>
          <AlertDialog.Description>
            “{viewName}” will be deleted for everyone who can see it. This can't be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <Button
            icon={<Trash2Icon />}
            variant="primary"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Delete view
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
