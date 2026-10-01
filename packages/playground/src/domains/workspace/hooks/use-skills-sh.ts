import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SkillsShInstallResponse, SkillsShRemoveResponse, SkillsShUpdateResponse } from '../types';

// =============================================================================
// Skill Management Hooks (via server proxy)
// =============================================================================

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
    mutationFn: async (params: InstallSkillParams): Promise<SkillsShInstallResponse> => {
      const [owner, repo] = params.repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Expected owner/repo');
      }

      const baseUrl = client.options.baseUrl || '';
      const url = `${baseUrl}/api/workspaces/${params.workspaceId}/skills-sh/install`;
      const body: Record<string, string> = { owner, repo, skillName: params.skillName };
      if (params.mount) {
        body.mount = params.mount;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `Failed to install skill: ${response.statusText}`);
      }

      return response.json().catch(() => {
        throw new Error('Invalid response from server');
      });
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
    mutationFn: async (params: UpdateSkillsParams): Promise<SkillsShUpdateResponse> => {
      const baseUrl = client.options.baseUrl || '';
      const url = `${baseUrl}/api/workspaces/${params.workspaceId}/skills-sh/update`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: params.skillName }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `Failed to update skill: ${response.statusText}`);
      }

      return response.json().catch(() => {
        throw new Error('Invalid response from server');
      });
    },
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
    mutationFn: async (params: RemoveSkillParams): Promise<SkillsShRemoveResponse> => {
      const baseUrl = client.options.baseUrl || '';
      const url = `${baseUrl}/api/workspaces/${params.workspaceId}/skills-sh/remove`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: params.skillName }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `Failed to remove skill: ${response.statusText}`);
      }

      return response.json().catch(() => {
        throw new Error('Invalid response from server');
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};
