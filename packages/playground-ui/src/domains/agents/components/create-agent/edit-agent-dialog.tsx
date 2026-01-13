'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentForm, AgentFormValues } from './agent-form';
import { DeleteAgentConfirm } from './delete-agent-confirm';
import { useStoredAgent, useStoredAgentMutations } from '../../hooks/use-stored-agents';
import type { UpdateStoredAgentParams } from '@mastra/client-js';

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

  const handleSubmit = async (values: UpdateStoredAgentParams) => {
    await updateStoredAgent.mutateAsync(values);
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

  const initialValues: Partial<AgentFormValues> | undefined = agent
    ? {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        model: agent.model,
        tools: agent.tools,
        workflows: agent.workflows,
        agents: agent.agents,
        memory: agent.memory,
      }
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
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
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              onDelete={handleDeleteClick}
              isSubmitting={updateStoredAgent.isPending}
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
