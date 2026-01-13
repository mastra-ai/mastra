'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

import { AgentForm } from './agent-form';
import type { AgentFormValues } from './form-validation';
import { useStoredAgentMutations } from '../../hooks/use-stored-agents';

export interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (agentId: string) => void;
}

export function CreateAgentDialog({ open, onOpenChange, onSuccess }: CreateAgentDialogProps) {
  const { createStoredAgent } = useStoredAgentMutations();

  const handleSubmit = async (values: AgentFormValues) => {
    const agentId = crypto.randomUUID();
    try {
      await createStoredAgent.mutateAsync({
        id: agentId,
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        model: values.model as Record<string, unknown>,
        tools: values.tools,
        workflows: values.workflows,
        agents: values.agents,
        memory: values.memory,
      });
      onOpenChange(false);
      onSuccess?.(agentId);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>Create a new agent with custom instructions and capabilities.</DialogDescription>
        </DialogHeader>
        <AgentForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createStoredAgent.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
