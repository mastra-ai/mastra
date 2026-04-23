import type { CreateStoredAgentParams, StoredAgentToolConfig, UpdateStoredAgentParams } from '@mastra/client-js';
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
  mode: 'create' | 'edit';
  availableTools?: AvailableTool[];
  onSuccess?: (agentId: string) => void;
}

export const useSaveAgent = ({ agentId, mode, availableTools = [], onSuccess }: UseSaveAgentArgs) => {
  const { createStoredAgent, updateStoredAgent } = useStoredAgentMutations(agentId);

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

      const toolsOrUndefined = Object.keys(tools).length > 0 ? tools : undefined;
      const skillsOrUndefined = Object.keys(skills).length > 0 ? skills : undefined;

      try {
        if (mode === 'edit') {
          const params: UpdateStoredAgentParams = {
            name: values.name,
            instructions: values.instructions,
            tools: toolsOrUndefined,
            skills: skillsOrUndefined,
          };
          const updated = await updateStoredAgent.mutateAsync(params);
          toast.success('Agent updated');
          onSuccess?.(agentId);
          return updated;
        }

        const params: CreateStoredAgentParams = {
          id: agentId,
          name: values.name,
          instructions: values.instructions,
          model: { provider: 'google', name: 'gemini-2.5-flash' },
          tools: toolsOrUndefined,
          skills: skillsOrUndefined,
        };
        const created = await createStoredAgent.mutateAsync(params);
        toast.success('Agent created');
        onSuccess?.(created.id);
        return created;
      } catch (error) {
        toast.error(`Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    },
    [agentId, mode, availableTools, createStoredAgent, updateStoredAgent, onSuccess],
  );

  return { save, isSaving: createStoredAgent.isPending || updateStoredAgent.isPending };
};
