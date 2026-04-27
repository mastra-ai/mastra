import { toast } from '@mastra/playground-ui';
import { useCallback } from 'react';
import { formValuesToSaveParams } from '../mappers/form-values-to-save-params';
import type { AgentBuilderEditFormValues } from '../schemas';
import type { AgentTool } from '../types/agent-tool';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

interface UseSaveAgentArgs {
  agentId: string;
  mode: 'create' | 'edit';
  availableAgentTools?: AgentTool[];
  onSuccess?: (agentId: string) => void;
}

export function useSaveAgent({ agentId, mode, availableAgentTools = [], onSuccess }: UseSaveAgentArgs) {
  const { createStoredAgent, updateStoredAgent } = useStoredAgentMutations(agentId);

  const save = useCallback(
    async (values: AgentBuilderEditFormValues) => {
      const params = formValuesToSaveParams(values, availableAgentTools);
      const workspaceField = params.workspace ? { workspace: params.workspace } : {};

      try {
        if (mode === 'edit') {
          const updated = await updateStoredAgent.mutateAsync({
            name: params.name,
            description: params.description,
            instructions: params.instructions,
            tools: params.tools,
            agents: params.agents,
            workflows: params.workflows,
            skills: params.skills,
            ...workspaceField,
          });
          toast.success('Agent updated');
          onSuccess?.(agentId);
          return updated;
        }

        const created = await createStoredAgent.mutateAsync({
          id: agentId,
          name: params.name,
          description: params.description,
          instructions: params.instructions,
          model: { provider: 'google', name: 'gemini-2.5-flash' },
          tools: params.tools,
          agents: params.agents,
          workflows: params.workflows,
          skills: params.skills,
          ...workspaceField,
        });
        toast.success('Agent created');
        onSuccess?.(created.id);
        return created;
      } catch (error) {
        toast.error(`Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    },
    [agentId, mode, availableAgentTools, createStoredAgent, updateStoredAgent, onSuccess],
  );

  return { save, isSaving: createStoredAgent.isPending || updateStoredAgent.isPending };
}
