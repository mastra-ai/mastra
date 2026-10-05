import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { isWorkspaceV1Supported, shouldRetryWorkspaceQuery } from './compatibility';
import type { Skill, ListSkillsResponse } from './types';

// =============================================================================
// Skills Hooks (via Workspace API)
// =============================================================================

export const useWorkspaceSkills = (options?: { workspaceId?: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'skills', options?.workspaceId],
    queryFn: async (): Promise<ListSkillsResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      return workspace.listSkills();
    },
    enabled: !!options?.workspaceId && isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
  });
};

// =============================================================================
// Agent-Specific Skill Hook
// =============================================================================

/**
 * Hook to get a specific skill from an agent's workspace
 * @param agentId - The agent ID (used for query key)
 * @param skillPath - The skill path to fetch
 * @param options - Options including workspaceId and enabled flag
 */
export const useAgentSkill = (
  agentId: string,
  skillName: string,
  options?: { enabled?: boolean; workspaceId?: string; path?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents', agentId, 'skills', skillName, options?.path, options?.workspaceId],
    queryFn: async (): Promise<Skill> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      const skill = workspace.getSkill(skillName, options?.path);
      return skill.details();
    },
    enabled:
      options?.enabled !== false &&
      !!agentId &&
      !!skillName &&
      !!options?.workspaceId &&
      isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
  });
};
