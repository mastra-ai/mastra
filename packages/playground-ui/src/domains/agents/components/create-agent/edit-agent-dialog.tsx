'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ds/components/Dialog';
import { Skeleton } from '@/ds/components/Skeleton';
import { AgentForm } from './agent-form';
import { DeleteAgentConfirm } from './delete-agent-confirm';
import { useStoredAgent, useStoredAgentMutations } from '../../hooks/use-stored-agents';
import type { AgentFormValues } from './form-validation';

export interface EditAgentDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

export function EditAgentDialog({ agentId, open, onOpenChange, onSuccess, onDelete }: EditAgentDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { data: agent, isLoading } = useStoredAgent(agentId);
  const { updateStoredAgent, deleteStoredAgent } = useStoredAgentMutations(agentId);

  const handleSubmit = async (values: AgentFormValues) => {
    await updateStoredAgent.mutateAsync({
      name: values.name,
      description: values.description,
      instructions: values.instructions,
      model: values.model,
      tools: values.tools,
      workflows: values.workflows,
      agents: values.agents,
      memory: values.memory ? { id: values.memory } : undefined,
    });
    onOpenChange(false);
    onSuccess?.();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    await deleteStoredAgent.mutateAsync();
    setShowDeleteConfirm(false);
    onOpenChange(false);
    onDelete?.();
  };

  // Transform agent data to form values format
  // Note: agent.memory from API is { id: string } but form expects just string
  const initialValues: Partial<AgentFormValues> | undefined = agent
    ? {
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        model: agent.model as { provider: string; name: string },
        tools: agent.tools,
        workflows: agent.workflows,
        agents: agent.agents,
        memory: (agent.memory as { id?: string } | undefined)?.id,
      }
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-surface1 border-border1 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>Update your agent configuration.</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ) : (
            <AgentForm
              mode="edit"
              agentId={agentId}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              onDelete={handleDeleteClick}
              isSubmitting={updateStoredAgent.isPending}
              isDeleting={deleteStoredAgent.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteAgentConfirm
        agentName={agent?.name || 'this agent'}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteStoredAgent.isPending}
      />
    </>
  );
}
