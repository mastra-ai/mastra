import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

/** Removes a board the project added, after asking. */
export function BoardDeleteButton({
  name,
  pending,
  onDelete,
}: {
  name: string;
  pending: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialog.Trigger
        render={
          <Button variant="ghost" size="sm" icon={<TrashIcon />} disabled={pending}>
            Delete
          </Button>
        }
      />
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete {name}?</AlertDialog.Title>
          <AlertDialog.Description>
            The board and its phases are removed from this project. A board that still has cards can’t be deleted.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onDelete}>Delete</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
