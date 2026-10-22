import { AlertDialog } from '@/ds/components/AlertDialog';

export function SavedViewDeleteDialog({
  view,
  onConfirm,
  onClose,
}: {
  /** The view to delete; the dialog is closed while this is `undefined`. */
  view: { name: string } | undefined;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open={view !== undefined}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete view?</AlertDialog.Title>
          <AlertDialog.Description>“{view?.name}” will be deleted. This can't be undone.</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onConfirm}>Delete view</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
