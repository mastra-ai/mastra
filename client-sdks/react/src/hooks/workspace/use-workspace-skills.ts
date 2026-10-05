import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { isWorkspaceV1Supported, shouldRetryWorkspaceQuery } from './compatibility';
import type { Skill, ListSkillsResponse } from './types';

// =============================================================================
// Skills Hooks (via Workspace API)
// =============================================================================

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useWorkspaceSkills = <TData = ListSkillsResponse>({
  workspaceId,
  queryOptions,
}: {
  workspaceId?: string;
  queryOptions?: MastraQueryOptions<ListSkillsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ListSkillsResponse, Error, TData>({
    queryKey: ['workspace', 'skills', workspaceId],
    queryFn: async (): Promise<ListSkillsResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(workspaceId);
      return workspace.listSkills();
    },
    enabled: isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
    ...queryOptions,
  });
};

// =============================================================================
// Agent-Specific Skill Hook
// =============================================================================

/**
 * Hook to get a specific skill from an agent's workspace
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useAgentSkill = <TData = Skill>({
  agentId,
  skillName,
  workspaceId,
  path,
  queryOptions,
}: {
  agentId: string;
  skillName: string;
  workspaceId?: string;
  path?: string;
  queryOptions?: MastraQueryOptions<Skill, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<Skill, Error, TData>({
    queryKey: ['agents', agentId, 'skills', skillName, path, workspaceId],
    queryFn: async (): Promise<Skill> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(workspaceId);
      const skill = workspace.getSkill(skillName, path);
      return skill.details();
    },
    enabled: isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
    ...queryOptions,
  });
};
