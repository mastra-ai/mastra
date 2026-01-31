'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { toast } from '@/lib/toast';

import { AgentForm } from './agent-form';
import type { AgentFormValues } from './form-validation';
import { useStoredAgent, useStoredAgentMutations } from '../../hooks/use-stored-agents';
import { Spinner } from '@/ds/components/Spinner';

export interface EditAgentDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

export function EditAgentDialog({ agentId, open, onOpenChange, onSuccess, onDelete }: EditAgentDialogProps) {
  const { data: agent, isLoading: isLoadingAgent } = useStoredAgent(agentId);
  const { updateStoredAgent, deleteStoredAgent } = useStoredAgentMutations(agentId);

  const handleSubmit = async (values: AgentFormValues) => {
    try {
      // Separate code-defined tools from integration tools
      // Integration tools are identified by checking if they exist in the agent's integrationTools array
      const codeDefinedTools: string[] = [];
      const integrationToolIds: string[] = [];

      // If the agent has integration tools, use those to separate tool types
      const existingIntegrationTools = new Set(agent?.integrationTools || []);

      if (values.tools) {
        for (const toolId of values.tools) {
          if (existingIntegrationTools.has(toolId)) {
            // This tool was previously marked as an integration tool
            integrationToolIds.push(toolId);
          } else {
            // This is a code-defined tool
            codeDefinedTools.push(toolId);
          }
        }
      }

      await updateStoredAgent.mutateAsync({
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        model: values.model as Record<string, unknown>,
        tools: codeDefinedTools,
        integrationTools: integrationToolIds,
        workflows: values.workflows,
        agents: values.agents,
        memory: values.memory,
        scorers: values.scorers,
      });
      toast.success('Agent updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteStoredAgent.mutateAsync();
      toast.success('Agent deleted successfully');
      onOpenChange(false);
      onDelete?.();
    } catch (error) {
      toast.error(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Transform agent data to form values
  const initialValues = React.useMemo(() => {
    if (!agent) return undefined;

    // Merge code-defined tools and integration tools
    const allTools: string[] = [];
    if (agent.tools && Array.isArray(agent.tools)) {
      allTools.push(...agent.tools);
    }
    if (agent.integrationTools && Array.isArray(agent.integrationTools)) {
      allTools.push(...agent.integrationTools);
    }

    return {
      name: agent.name || '',
      description: agent.description || '',
      instructions: agent.instructions || '',
      model: {
        provider: (agent.model as { provider?: string; name?: string })?.provider || '',
        name: (agent.model as { provider?: string; name?: string })?.name || '',
      },
      tools: allTools,
      workflows: agent.workflows || [],
      agents: agent.agents || [],
      memory: agent.memory || '',
      scorers: agent.scorers || {},
    };
  }, [agent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
        </DialogHeader>
        {isLoadingAgent ? (
          <div className="flex items-center justify-center py-8 px-6">
            <Spinner className="h-8 w-8" />
          </div>
        ) : initialValues ? (
          <AgentForm
            mode="edit"
            agentId={agentId}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onDelete={handleDelete}
            isSubmitting={updateStoredAgent.isPending}
            isDeleting={deleteStoredAgent.isPending}
            excludeAgentId={agentId}
          />
        ) : (
          <div className="flex items-center justify-center py-8 px-6 text-icon3">Agent not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
