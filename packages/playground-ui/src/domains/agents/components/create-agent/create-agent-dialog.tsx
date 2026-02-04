'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
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
  const dialogContentRef = React.useRef<HTMLDivElement>(null);
  const { createStoredAgent } = useStoredAgentMutations();

  const handleSubmit = async (values: AgentFormValues) => {
    if (!values) {
      toast.error('Form submission error: No data received');
      return;
    }
    
    if (!values.instructions) {
      toast.error('Form data is invalid. Please fill in all required fields.');
      return;
    }

    const agentId = crypto.randomUUID();
    try {
      const createParams = {
        id: agentId,
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        model: values.model,
        tools: values.tools && values.tools.length > 0 ? values.tools : undefined,
        workflows: values.workflows,
        agents: values.agents,
        memory: values.memory,
        scorers: values.scorers,
      };

      const createdAgent = await createStoredAgent.mutateAsync(createParams);
      toast.success('Agent created successfully');
      onOpenChange(false);
      onSuccess?.(createdAgent.id);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContentRef} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
        </DialogHeader>
        <AgentForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createStoredAgent.isPending}
          container={dialogContentRef}
        />
      </DialogContent>
    </Dialog>
  );
}
