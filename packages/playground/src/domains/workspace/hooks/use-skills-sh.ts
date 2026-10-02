import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
    mutationFn: (params: InstallSkillParams) => {
      const [owner, repo] = params.repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Expected owner/repo');
      }
      return client
        .getWorkspace(params.workspaceId)
        .installSkillsSh({ owner, repo, skillName: params.skillName, mount: params.mount });
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
      client.getWorkspace(params.workspaceId).updateSkillsSh({ skillName: params.skillName }),
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
      client.getWorkspace(params.workspaceId).removeSkillsSh({ skillName: params.skillName }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};
