import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { StoredAgentSkillConfig, UpdateStoredAgentParams } from '@mastra/client-js';
import { usePlaygroundStore } from '@/store/playground-store';

import { useStoredAgent } from './use-stored-agents';

/**
 * Hook to read and mutate the skills config for a stored agent.
 *
 * The skills field is `Record<string, StoredAgentSkillConfig>` on the agent
 * snapshot. Each key is a stored skill ID and the value holds per-skill
 * overrides (description, instructions, pin, strategy).
 */
export function useAgentSkills(agentId?: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const { data: agent } = useStoredAgent(agentId, { status: 'draft' });

  const skills = useMemo((): Record<string, StoredAgentSkillConfig> => {
    if (!agent?.skills) return {};
    // Handle conditional field: if it's an array of variants, merge values
    if (Array.isArray(agent.skills)) {
      const merged: Record<string, StoredAgentSkillConfig> = {};
      for (const variant of agent.skills) {
        Object.assign(merged, variant.value);
      }
      return merged;
    }
    return agent.skills as Record<string, StoredAgentSkillConfig>;
  }, [agent?.skills]);

  const updateSkills = useMutation({
    mutationFn: (newSkills: Record<string, StoredAgentSkillConfig> | undefined) => {
      if (!agentId) throw new Error('agentId is required');
      const params: UpdateStoredAgentParams = { skills: newSkills };
      return client.getStoredAgent(agentId).update(params, requestContext);
    },
    onSuccess: () => {
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      }
    },
  });

  return { skills, updateSkills };
}
