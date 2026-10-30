import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';

export interface MoveRootDialogProps {
  /** Display label of the root the connection is moving to. */
  target: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Saving a new root moves everything already imported, so it asks first. */
export function MoveRootDialog({ target, open, onOpenChange, onConfirm }: MoveRootDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Move to {target}?</AlertDialog.Title>
          <AlertDialog.Description>
            Moves everything this connection imported to {target} on its next run.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <Button variant="primary" onClick={onConfirm}>
            Move and save
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
