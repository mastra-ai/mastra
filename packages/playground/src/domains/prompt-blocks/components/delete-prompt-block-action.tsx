import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useStoredPromptBlockMutations } from '../hooks/use-stored-prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

interface UseDeletePromptBlockActionParams {
  blockId: string;
}

const useDeletePromptBlockAction = ({ blockId }: UseDeletePromptBlockActionParams) => {
  const [open, setOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { deleteStoredPromptBlock } = useStoredPromptBlockMutations(blockId);

  const confirm = async () => {
    try {
      await deleteStoredPromptBlock.mutateAsync();
      toast.success('Prompt block deleted');
      setOpen(false);
      void navigate(paths.promptBlocksLink());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete prompt block');
    }
  };

  return {
    open,
    setOpen,
    isPending: deleteStoredPromptBlock.isPending,
    confirm,
  };
};

interface DeletePromptBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockName: string;
  isPending: boolean;
  onConfirm: () => void;
}

const DeletePromptBlockDialog = ({
  open,
  onOpenChange,
  blockName,
  isPending,
  onConfirm,
}: DeletePromptBlockDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content data-testid="delete-prompt-block-dialog">
        <AlertDialog.Header>
          <AlertDialog.Title>Delete prompt block?</AlertDialog.Title>
          <AlertDialog.Description>
            This permanently deletes &quot;{blockName}&quot;. This cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel data-testid="delete-prompt-block-cancel" disabled={isPending}>
            Cancel
          </AlertDialog.Cancel>
          <Button
            variant="primary"
            data-testid="delete-prompt-block-confirm"
            disabled={isPending}
            onClick={() => {
              // Use a plain button (not AlertDialog.Close) so the dialog stays
              // open while the request is in flight and on error.
              onConfirm();
            }}
          >
            {isPending ? 'Deleting…' : 'Delete prompt block'}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
};

interface DeletePromptBlockButtonProps {
  blockId: string;
  blockName: string;
  disabled?: boolean;
}

export const DeletePromptBlockButton = ({ blockId, blockName, disabled = false }: DeletePromptBlockButtonProps) => {
  const { open, setOpen, isPending, confirm } = useDeletePromptBlockAction({ blockId });

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        data-testid="delete-prompt-block"
        variant="ghost"
        size="sm"
      >
        <Trash2 />
        Delete
      </Button>
      <DeletePromptBlockDialog
        open={open}
        onOpenChange={setOpen}
        blockName={blockName}
        isPending={isPending}
        onConfirm={confirm}
      />
    </>
  );
};
