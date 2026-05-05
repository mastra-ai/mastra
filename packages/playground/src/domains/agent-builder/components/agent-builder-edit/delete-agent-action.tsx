import { AlertDialog, Button, DropdownMenu, toast } from '@mastra/playground-ui';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

interface UseDeleteAgentActionParams {
  agentId: string;
  agentName: string;
}

const useDeleteAgentAction = ({ agentId }: UseDeleteAgentActionParams) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { deleteStoredAgent } = useStoredAgentMutations(agentId);

  const confirm = async () => {
    try {
      await deleteStoredAgent.mutateAsync(undefined);
      toast.success('Agent deleted');
      setOpen(false);
      void navigate('/agent-builder/agents', { viewTransition: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  };

  return {
    open,
    setOpen,
    isPending: deleteStoredAgent.isPending,
    confirm,
  };
};

interface DeleteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  isPending: boolean;
  onConfirm: () => void;
}

const DeleteAgentDialog = ({ open, onOpenChange, agentName, isPending, onConfirm }: DeleteAgentDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialog.Content data-testid="agent-builder-delete-agent-dialog">
      <AlertDialog.Header>
        <AlertDialog.Title>Delete agent?</AlertDialog.Title>
        <AlertDialog.Description>
          This permanently deletes &quot;{agentName}&quot; and removes its conversation history. This cannot be undone.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel data-testid="agent-builder-delete-agent-cancel" disabled={isPending}>
          Cancel
        </AlertDialog.Cancel>
        <AlertDialog.Action
          data-testid="agent-builder-delete-agent-confirm"
          disabled={isPending}
          onClick={event => {
            // Prevent default so the dialog stays open while the request is in flight.
            event.preventDefault();
            onConfirm();
          }}
        >
          {isPending ? 'Deleting…' : 'Delete agent'}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog>
);

interface DeleteAgentEntryProps {
  agentId: string;
  agentName: string;
  disabled?: boolean;
}

export const DeleteAgentDesktopButton = ({ agentId, agentName, disabled = false }: DeleteAgentEntryProps) => {
  const { open, setOpen, isPending, confirm } = useDeleteAgentAction({ agentId, agentName });

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        tooltip="Delete agent"
        data-testid="agent-builder-delete-agent"
      >
        <Trash2 />
      </Button>
      <DeleteAgentDialog
        open={open}
        onOpenChange={setOpen}
        agentName={agentName}
        isPending={isPending}
        onConfirm={confirm}
      />
    </>
  );
};

export const DeleteAgentMenuItem = ({ agentId, agentName, disabled = false }: DeleteAgentEntryProps) => {
  const { open, setOpen, isPending, confirm } = useDeleteAgentAction({ agentId, agentName });

  return (
    <>
      <DropdownMenu.Item
        data-testid="agent-builder-mobile-menu-delete"
        disabled={disabled}
        className="text-red-500 focus:text-red-400"
        onSelect={event => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <Trash2 />
        <span>Delete agent</span>
      </DropdownMenu.Item>
      <DeleteAgentDialog
        open={open}
        onOpenChange={setOpen}
        agentName={agentName}
        isPending={isPending}
        onConfirm={confirm}
      />
    </>
  );
};
