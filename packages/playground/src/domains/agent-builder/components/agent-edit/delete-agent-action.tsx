import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { DeleteAgentConfirmation } from '@mastra/playground-ui/domains/agents/components/delete-agent-confirmation';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useStoredAgentMutations, useStoredAgentDependents } from '@mastra/react/hooks/agents';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AgentImpactWarnings } from './agent-impact-warnings';

interface UseDeleteAgentActionParams {
  agentId: string;
  agentName: string;
}

const useDeleteAgentAction = ({ agentId }: UseDeleteAgentActionParams) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { deleteStoredAgent } = useStoredAgentMutations({ agentId: agentId });

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
  const { isLoading: isDependentsLoading } = useStoredAgentDependents({
    agentId: agentId,
    queryOptions: { enabled: Boolean(agentId) && open },
  });

  return (
    <DeleteAgentConfirmation
      open={open}
      onOpenChange={onOpenChange}
      description={
        <>
          This permanently deletes &quot;{agentName}&quot; and removes its conversation history. This cannot be undone.
        </>
      }
      isPending={isPending}
      isDependentsLoading={isDependentsLoading}
      onConfirm={onConfirm}
    >
      <AgentImpactWarnings agentId={agentId} variant="delete" enabled={open} />
    </DeleteAgentConfirmation>
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
        icon={<TrashIcon />}
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
        variant="destructive"
        onSelect={event => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <TrashIcon />
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
