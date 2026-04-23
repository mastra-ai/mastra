import type { CreateStoredAgentParams, StoredAgentToolConfig } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useCallback } from 'react';
import type { AgentBuilderEditFormValues } from '../schemas';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

interface AvailableTool {
  id: string;
  description?: string;
}

interface UseSaveAgentArgs {
  agentId: string;
  availableTools?: AvailableTool[];
  onSuccess?: (agentId: string) => void;
}

export const useSaveAgent = ({ agentId, availableTools = [], onSuccess }: UseSaveAgentArgs) => {
  const { createStoredAgent } = useStoredAgentMutations();

  const save = useCallback(
    async (values: AgentBuilderEditFormValues) => {
      const descriptionById = new Map(availableTools.map(t => [t.id, t.description]));

      const tools: Record<string, StoredAgentToolConfig> = Object.fromEntries(
        Object.entries(values.tools ?? {})
          .filter(([, enabled]) => enabled)
          .map(([id]) => {
            const description = descriptionById.get(id);
            return [id, description ? { description } : {}];
          }),
      );

      const skills = Object.fromEntries((values.skills ?? []).map(skillId => [skillId, {}]));

      const params: CreateStoredAgentParams = {
        id: agentId,
        name: values.name,
        instructions: values.instructions,
        model: { provider: 'google', name: 'gemini-2.5-flash' },
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        skills: Object.keys(skills).length > 0 ? skills : undefined,
      };

      try {
        const created = await createStoredAgent.mutateAsync(params);
        toast.success('Agent saved');
        onSuccess?.(created.id);
        return created;
      } catch (error) {
        toast.error(`Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    },
    [agentId, availableTools, createStoredAgent, onSuccess],
  );

  return { save, isSaving: createStoredAgent.isPending };
};
