import { useQuery, useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { isWorkspaceV1Supported, shouldRetryWorkspaceQuery } from '../compatibility';
import type {
  Skill,
  ListSkillsResponse,
  SearchSkillsResponse,
  ListReferencesResponse,
  GetReferenceResponse,
  SearchSkillsParams,
} from '../types';

// =============================================================================
// Skills Hooks (via Workspace API)
// =============================================================================

/**
 * Hook to list all discovered skills via workspace
 */
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

/**
 * Hook to get a specific skill's full details via workspace
 */
export const useWorkspaceSkill = (skillPath: string, options?: { enabled?: boolean; workspaceId?: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'skills', skillPath, options?.workspaceId],
    queryFn: async (): Promise<Skill> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      const skill = workspace.getSkill(skillPath);
      return skill.details();
    },
    enabled: options?.enabled !== false && !!skillPath && !!options?.workspaceId && isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
  });
};

/**
 * Hook to list references for a skill via workspace
 */
export const useWorkspaceSkillReferences = (
  skillPath: string,
  options?: { enabled?: boolean; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'skills', skillPath, 'references', options?.workspaceId],
    queryFn: async (): Promise<ListReferencesResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      const skill = workspace.getSkill(skillPath);
      return skill.listReferences();
    },
    enabled: options?.enabled !== false && !!skillPath && !!options?.workspaceId && isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
  });
};

/**
 * Hook to get a specific reference file content via workspace
 */
export const useWorkspaceSkillReference = (
  skillPath: string,
  referencePath: string,
  options?: { enabled?: boolean; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'skills', skillPath, 'references', referencePath, options?.workspaceId],
    queryFn: async (): Promise<GetReferenceResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      const skill = workspace.getSkill(skillPath);
      return skill.getReference(referencePath);
    },
    enabled:
      options?.enabled !== false &&
      !!skillPath &&
      !!referencePath &&
      !!options?.workspaceId &&
      isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
  });
};

/**
 * Hook to search across skills via workspace
 */
export const useSearchWorkspaceSkills = () => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async (params: SearchSkillsParams): Promise<SearchSkillsResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.searchSkills(params);
    },
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
  skillPath: string,
  options?: { enabled?: boolean; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents', agentId, 'skills', skillPath, options?.workspaceId],
    queryFn: async (): Promise<Skill> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      const skill = workspace.getSkill(skillPath);
      return skill.details();
    },
    enabled:
      options?.enabled !== false &&
      !!agentId &&
      !!skillPath &&
      !!options?.workspaceId &&
      isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
  });
};
