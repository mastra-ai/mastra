import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useStoredPromptBlockMutations } from '../../hooks/use-stored-prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

interface DeletePromptBlockActionProps {
  blockId: string;
  blockName: string;
  disabled?: boolean;
}

export function DeletePromptBlockAction({ blockId, blockName, disabled = false }: DeletePromptBlockActionProps) {
  const [open, setOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { deleteStoredPromptBlock } = useStoredPromptBlockMutations(blockId);

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
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        data-testid="prompt-block-delete"
        variant="ghost"
        size="sm"
      >
        <Trash2 />
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
              disabled={isPending}
              onClick={() => {
                // Use a plain button (not AlertDialog.Close) so the dialog stays
                // open while the request is in flight and on error.
                void confirm();
              }}
            >
              {isPending ? 'Deleting…' : 'Delete prompt block'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
