'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { toast } from '@/lib/toast';

import { AgentForm } from './agent-form';
import type { AgentFormValues } from './form-validation';
import { useStoredAgentMutations } from '../../hooks/use-stored-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

export interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (agentId: string) => void;
}

export function CreateAgentDialog({ open, onOpenChange, onSuccess }: CreateAgentDialogProps) {
  const { createStoredAgent } = useStoredAgentMutations();
  const { data: toolsData } = useTools();

  const handleSubmit = async (values: AgentFormValues) => {
    const agentId = crypto.randomUUID();
    try {
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

      await createStoredAgent.mutateAsync({
        id: agentId,
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        model: values.model as Record<string, unknown>,
        tools: codeDefinedTools.length > 0 ? codeDefinedTools : undefined,
        integrations: integrationIds.length > 0 ? integrationIds : undefined,
        integrationTools: integrationToolIds.length > 0 ? integrationToolIds : undefined,
        workflows: values.workflows,
        agents: values.agents,
        memory: values.memory ? { id: values.memory } : undefined,
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
      <DialogContent className="bg-surface1 border-border1 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
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
