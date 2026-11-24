import { useStoredPromptBlockMutations } from '@mastra/react/hooks/prompt-blocks';
import { useState } from 'react';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/utils/toast';

interface DeletePromptBlockActionProps {
  blockId: string;
  blockName: string;
  disabled?: boolean;
}

export function DeletePromptBlockAction({ blockId, blockName, disabled = false }: DeletePromptBlockActionProps) {
  const [open, setOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { deleteStoredPromptBlock } = useStoredPromptBlockMutations({ blockId: blockId });

  const isPending = deleteStoredPromptBlock.isPending;

  const confirm = async () => {
    try {
      await deleteStoredPromptBlock.mutateAsync();
      toast.success('Prompt block deleted');
      setOpen(false);
      navigate(paths.promptBlocksLink());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete prompt block');
    }
  };

  return (
    <>
      <Button
        icon={<TrashIcon />}
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        data-testid="prompt-block-delete"
        variant="ghost"
        size="sm"
      >
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialog.Content data-testid="prompt-block-delete-dialog">
          <AlertDialog.Header>
            <AlertDialog.Title>Delete prompt block?</AlertDialog.Title>
            <AlertDialog.Description>
              This permanently deletes &quot;{blockName}&quot;. This cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel data-testid="prompt-block-delete-cancel" disabled={isPending}>
              Cancel
            </AlertDialog.Cancel>
            <Button
              variant="primary"
              data-testid="prompt-block-delete-confirm"
              onClick={() => {
                // Use a plain button (not AlertDialog.Close) so the dialog stays
                // open while the request is in flight and on error.
                void confirm();
              }}
              loading={isPending}
            >
              Delete prompt block
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
