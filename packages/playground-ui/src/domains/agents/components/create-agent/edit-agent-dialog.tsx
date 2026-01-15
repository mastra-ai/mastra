'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ds/components/Dialog';
import { Skeleton } from '@/ds/components/Skeleton';
import { AgentForm } from './agent-form';
import { DeleteAgentConfirm } from './delete-agent-confirm';
import { useStoredAgent, useStoredAgentMutations } from '../../hooks/use-stored-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
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
  const { data: toolsData, isLoading: toolsLoading } = useTools();

  // Build the initial tools list including integration tools
  // agent.tools contains code-defined tool IDs (e.g., ["cookingTool"])
  // agent.integrationTools contains specific integration tool IDs (e.g., ["composio_hackernews_HACKERNEWS_GET_FRONTPAGE"])
  const initialTools = useMemo(() => {
    if (!agent || !toolsData) return undefined;

    const tools: string[] = [...(agent.tools || [])];

    // Add specific integration tools that were saved
    if (agent.integrationTools && agent.integrationTools.length > 0) {
      for (const toolId of agent.integrationTools) {
        if (!tools.includes(toolId)) {
          tools.push(toolId);
        }
      }
    }

    return tools;
  }, [agent, toolsData]);

  const handleSubmit = async (values: AgentFormValues) => {
    // Separate code-defined tools from integration tools
    const codeDefinedTools: string[] = [];
    const integrationToolIds: string[] = [];
    const integrationIdsSet = new Set<string>();

    if (values.tools && toolsData) {
      for (const toolId of values.tools) {
        const toolData = toolsData[toolId] as { integrationId?: string } | undefined;
        if (toolData?.integrationId) {
          // This is an integration tool - store the specific tool ID and its integration ID
          integrationToolIds.push(toolId);
          integrationIdsSet.add(toolData.integrationId);
        } else {
          // This is a code-defined tool
          codeDefinedTools.push(toolId);
        }
      }
    }

    const integrationIds = Array.from(integrationIdsSet);

    await updateStoredAgent.mutateAsync({
      name: values.name,
      description: values.description,
      instructions: values.instructions,
      model: values.model,
      tools: codeDefinedTools.length > 0 ? codeDefinedTools : undefined,
      integrations: integrationIds.length > 0 ? integrationIds : undefined,
      integrationTools: integrationToolIds.length > 0 ? integrationToolIds : undefined,
      workflows: values.workflows,
      agents: values.agents,
      memory: values.memory ? { id: values.memory } : undefined,
      scorers: values.scorers,
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
  // Use initialTools which includes both code-defined tools AND integration tools
  const initialValues: Partial<AgentFormValues> | undefined = agent
    ? {
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        model: agent.model as { provider: string; name: string },
        tools: initialTools,
        workflows: agent.workflows,
        agents: agent.agents,
        memory: (agent.memory as { id?: string } | undefined)?.id,
        scorers: agent.scorers,
      }
    : undefined;

  // Wait for both agent and tools data before showing the form
  const isDataLoading = isLoading || toolsLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-surface1 border-border1 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>Update your agent configuration.</DialogDescription>
          </DialogHeader>

          {isDataLoading ? (
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
