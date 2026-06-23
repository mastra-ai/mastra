import { Button, toast } from '@mastra/playground-ui';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AgentImpactWarnings } from './agent-impact-warnings';
import { useStoredAgentMutations, useStoredAgentDependents } from '@/domains/agents/hooks/use-stored-agents';

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
  agentId: string;
  agentName: string;
  isPending: boolean;
  onConfirm: () => void;
}

const DeleteAgentDialog = ({
  open,
  onOpenChange,
  agentId,
  agentName,
  isPending,
  onConfirm,
}: DeleteAgentDialogProps) => {
  const { isLoading: isDependentsLoading } = useStoredAgentDependents(agentId, { enabled: open });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content data-testid="agent-builder-delete-agent-dialog">
        <AlertDialog.Header>
          <AlertDialog.Title>Delete agent?</AlertDialog.Title>
          <AlertDialog.Description>
            This permanently deletes &quot;{agentName}&quot; and removes its conversation history. This cannot be
            undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Body className="pt-0">
          <AgentImpactWarnings agentId={agentId} variant="delete" enabled={open} />
        </AlertDialog.Body>
        <AlertDialog.Footer>
          <AlertDialog.Cancel data-testid="agent-builder-delete-agent-cancel" disabled={isPending}>
            Cancel
          </AlertDialog.Cancel>
          <Button
            variant="primary"
            data-testid="agent-builder-delete-agent-confirm"
            disabled={isPending || isDependentsLoading}
            onClick={() => {
              // Use a plain button (not AlertDialog.Close) so the dialog stays
              // open while the request is in flight and on error.
              onConfirm();
            }}
          >
            {isPending ? 'Deleting…' : 'Delete agent'}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
};

interface DeleteAgentEntryProps {
  agentId: string;
  agentName: string;
  disabled?: boolean;
}

export const DeleteAgentPanelButton = ({ agentId, agentName, disabled = false }: DeleteAgentEntryProps) => {
  const { open, setOpen, isPending, confirm } = useDeleteAgentAction({ agentId, agentName });

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        data-testid="agent-builder-delete-agent"
        variant="ghost"
        size="sm"
      >
        Delete agent
      </Button>
      <DeleteAgentDialog
        open={open}
        onOpenChange={setOpen}
        agentId={agentId}
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
        agentId={agentId}
        agentName={agentName}
        isPending={isPending}
        onConfirm={confirm}
      />
    </>
  );
};
