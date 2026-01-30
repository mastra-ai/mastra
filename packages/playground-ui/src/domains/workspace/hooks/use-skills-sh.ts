import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type {
  SkillsShSearchResponse,
  SkillsShListResponse,
  SandboxExecuteParams,
  SandboxExecuteResponse,
  SkillsShRemoveResponse,
  SkillsShUpdateResponse,
} from '../types';
import { isWorkspaceV1Supported } from '../compatibility';

// =============================================================================
// skills.sh API Hooks (via server proxy to avoid CORS)
// =============================================================================

/**
 * Search skills on skills.sh (via server proxy)
 */
export const useSearchSkillsSh = (workspaceId: string | undefined) => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async (query: string): Promise<SkillsShSearchResponse> => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const baseUrl = (client as any).baseUrl || '';
      const url = `${baseUrl}/api/workspaces/${workspaceId}/skills-sh/search?q=${encodeURIComponent(query)}&limit=10`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to search skills: ${response.statusText}`);
      }
      return response.json();
    },
  });
};

/**
 * Get popular skills from skills.sh (via server proxy, cached for 5 minutes)
 */
export const usePopularSkillsSh = (workspaceId: string | undefined) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['skills-sh', 'popular', workspaceId],
    queryFn: async (): Promise<SkillsShListResponse> => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const baseUrl = (client as any).baseUrl || '';
      const url = `${baseUrl}/api/workspaces/${workspaceId}/skills-sh/popular?limit=10&offset=0`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch popular skills: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!workspaceId,
  });
};

/**
 * Preview a skill by fetching its SKILL.md (via server proxy to avoid CORS)
 */
export const useSkillPreview = (
  workspaceId: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
  skillPath: string | undefined,
  options?: { enabled?: boolean },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['skills-sh', 'preview', workspaceId, owner, repo, skillPath],
    queryFn: async (): Promise<string> => {
      if (!workspaceId || !owner || !repo || !skillPath) {
        throw new Error('workspaceId, owner, repo, and skillPath are required');
      }
      const baseUrl = (client as any).baseUrl || '';
      const params = new URLSearchParams({ owner, repo, path: skillPath });
      const url = `${baseUrl}/api/workspaces/${workspaceId}/skills-sh/preview?${params}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch preview: ${response.statusText}`);
      }
      const data = await response.json();
      return data.content;
    },
    enabled: options?.enabled !== false && !!workspaceId && !!owner && !!repo && !!skillPath,
    retry: false,
  });
};

// =============================================================================
// Sandbox Execute Hook (Server-side via workspace)
// =============================================================================

/**
 * Execute a command in the workspace sandbox
 */
export const useSandboxExecute = () => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async (params: SandboxExecuteParams): Promise<SandboxExecuteResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.sandboxExecute({
        command: params.command,
        args: params.args,
        cwd: params.cwd,
        timeout: params.timeout,
      });
    },
  });
};

// =============================================================================
// Skill Management Hooks (CLI via sandbox)
// =============================================================================

export interface InstallSkillParams {
  workspaceId: string;
  /** Repository in format owner/repo */
  repository: string;
  /** Skill name within the repo */
  skillName: string;
}

export interface SkillsShInstallResult {
  success: boolean;
  skillName: string;
  installedPath: string;
  filesWritten: number;
}

/**
 * Install a skill by fetching from GitHub and writing to workspace filesystem.
 * Does NOT require sandbox - only requires filesystem access.
 */
export const useInstallSkill = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: InstallSkillParams): Promise<SkillsShInstallResult> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }

      // Parse repository to get owner and repo
      const [owner, repo] = params.repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Expected owner/repo');
      }

      const workspace = (client as any).getWorkspace(params.workspaceId);
      const result = await workspace.skillsShInstall({
        owner,
        repo,
        skillName: params.skillName,
      });

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate skills list to refresh after installation
      queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};

export interface UpdateSkillsParams {
  workspaceId: string;
  skillName?: string;
}

/**
 * Update installed skills by re-fetching from GitHub.
 * Does NOT require sandbox - only requires filesystem access.
 */
export const useUpdateSkills = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateSkillsParams): Promise<SkillsShUpdateResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.skillsShUpdate({ skillName: params.skillName });
    },
    onSuccess: (_, variables) => {
      // Invalidate skills list to refresh after update
      queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};

export interface RemoveSkillParams {
  workspaceId: string;
  skillName: string;
}

/**
 * Remove an installed skill by deleting its directory.
 * Does NOT require sandbox - only requires filesystem access.
 */
export const useRemoveSkill = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RemoveSkillParams): Promise<SkillsShRemoveResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.skillsShRemove({ skillName: params.skillName });
    },
    onSuccess: (_, variables) => {
      // Invalidate skills list to refresh after removal
      queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
  });
};

// =============================================================================
// Helper: Parse skills.sh skill ID to repository info
// =============================================================================

/**
 * Parse a skill's topSource field to extract GitHub repository info
 *
 * skills.sh topSource formats:
 * - "owner/repo" (e.g., "vercel-labs/agent-skills")
 * - "owner/repo/path" (e.g., "anthropics/skills/frontend-design")
 * - "github.com/owner/repo/path" (full URL format)
 *
 * The skill name is used as the path within the repo when not specified
 */
export function parseSkillSource(
  topSource: string,
  skillName?: string,
): {
  owner: string;
  repo: string;
  skillPath: string;
} | null {
  // Remove protocol and github.com prefix if present
  let cleanSource = topSource.replace(/^https?:\/\//, '');
  cleanSource = cleanSource.replace(/^github\.com\//, '');

  const parts = cleanSource.split('/');

  if (parts.length < 2) {
    return null;
  }

  const owner = parts[0];
  const repo = parts[1];

  // If there's a path in topSource, use it; otherwise use skill name
  let skillPath: string;
  if (parts.length > 2) {
    // Path is specified in topSource (e.g., "anthropics/skills/frontend-design")
    skillPath = parts.slice(2).join('/');
  } else if (skillName) {
    // No path in topSource, use skill name (e.g., for "vercel-labs/agent-skills" + skill "web-design-guidelines")
    skillPath = skillName;
  } else {
    return null;
  }

  return {
    owner,
    repo,
    skillPath,
  };
}
