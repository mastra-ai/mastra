import { useQuery, useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { isWorkspaceV1Supported } from './use-workspace';
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
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      return workspace.listSkills();
    },
    enabled: isWorkspaceV1Supported(client),
  });
};

/**
 * Hook to get a specific skill's full details via workspace
 */
export const useWorkspaceSkill = (skillName: string, options?: { enabled?: boolean; workspaceId?: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'skills', skillName, options?.workspaceId],
    queryFn: async (): Promise<Skill> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      const skill = workspace.getSkill(skillName);
      return skill.details();
    },
    enabled: options?.enabled !== false && !!skillName && isWorkspaceV1Supported(client),
  });
};

/**
 * Hook to list references for a skill via workspace
 */
export const useWorkspaceSkillReferences = (
  skillName: string,
  options?: { enabled?: boolean; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'skills', skillName, 'references', options?.workspaceId],
    queryFn: async (): Promise<ListReferencesResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      const skill = workspace.getSkill(skillName);
      return skill.listReferences();
    },
    enabled: options?.enabled !== false && !!skillName && isWorkspaceV1Supported(client),
  });
};

/**
 * Hook to get a specific reference file content via workspace
 */
export const useWorkspaceSkillReference = (
  skillName: string,
  referencePath: string,
  options?: { enabled?: boolean; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'skills', skillName, 'references', referencePath, options?.workspaceId],
    queryFn: async (): Promise<GetReferenceResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      const skill = workspace.getSkill(skillName);
      return skill.getReference(referencePath);
    },
    enabled: options?.enabled !== false && !!skillName && !!referencePath && isWorkspaceV1Supported(client),
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
 * @param skillName - The skill name to fetch
 * @param options - Options including workspaceId and enabled flag
 */
export const useAgentSkill = (
  agentId: string,
  skillName: string,
  options?: { enabled?: boolean; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents', agentId, 'skills', skillName, options?.workspaceId],
    queryFn: async (): Promise<Skill> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      const skill = workspace.getSkill(skillName);
      return skill.details();
    },
    enabled: options?.enabled !== false && !!agentId && !!skillName && isWorkspaceV1Supported(client),
  });
};
