import type { RouteResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// =============================================================================
// Skill Management Hooks (via server proxy)
// =============================================================================

const skillsShPath = (workspaceId: string, route: 'install' | 'update' | 'remove') =>
  `/workspaces/${encodeURIComponent(workspaceId)}/skills-sh/${route}`;

export interface InstallSkillParams {
  workspaceId: string;
  /** Repository in format owner/repo */
  repository: string;
  /** Skill name within the repo */
  skillName: string;
  /** Mount path to install into (for CompositeFilesystem) */
  mount?: string;
}

/**
 * Install a skill by fetching from GitHub and writing to workspace filesystem.
 */
export const useInstallSkill = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: InstallSkillParams) => {
      const [owner, repo] = params.repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Expected owner/repo');
      }
      return client.request<RouteResponse<'POST /workspaces/:workspaceId/skills-sh/install'>>(
        skillsShPath(params.workspaceId, 'install'),
        {
          method: 'POST',
          body: { owner, repo, skillName: params.skillName, ...(params.mount ? { mount: params.mount } : {}) },
          retries: 0,
        },
      );
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};

export interface UpdateSkillsParams {
  workspaceId: string;
  skillName?: string;
}

/**
 * Update installed skills by re-fetching from GitHub.
 */
export const useUpdateSkills = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateSkillsParams) =>
      client.request<RouteResponse<'POST /workspaces/:workspaceId/skills-sh/update'>>(
        skillsShPath(params.workspaceId, 'update'),
        { method: 'POST', body: { skillName: params.skillName }, retries: 0 },
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};

export interface RemoveSkillParams {
  workspaceId: string;
  skillName: string;
}

/**
 * Remove an installed skill by deleting its directory.
 */
export const useRemoveSkill = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: RemoveSkillParams) =>
      client.request<RouteResponse<'POST /workspaces/:workspaceId/skills-sh/remove'>>(
        skillsShPath(params.workspaceId, 'remove'),
        { method: 'POST', body: { skillName: params.skillName }, retries: 0 },
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};
