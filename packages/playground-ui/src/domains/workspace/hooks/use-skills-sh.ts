import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type {
  SkillsShSearchResponse,
  SkillsShListResponse,
  SkillsShInstallResponse,
  SkillsShRemoveResponse,
  SkillsShUpdateResponse,
} from '../types';

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
      const baseUrl = client.options.baseUrl || '';
      const url = `${baseUrl}/api/workspaces/${workspaceId}/skills-sh/search?q=${encodeURIComponent(query)}&limit=10`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to search skills: ${response.statusText}`);
      }
      return response.json().catch(() => {
        throw new Error('Invalid response from server');
      });
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
      const baseUrl = client.options.baseUrl || '';
      const url = `${baseUrl}/api/workspaces/${workspaceId}/skills-sh/popular?limit=10&offset=0`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch popular skills: ${response.statusText}`);
      }
      return response.json().catch(() => {
        throw new Error('Invalid response from server');
      });
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
      const baseUrl = client.options.baseUrl || '';
      const params = new URLSearchParams({ owner, repo, path: skillPath });
      const url = `${baseUrl}/api/workspaces/${workspaceId}/skills-sh/preview?${params}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch preview: ${response.statusText}`);
      }
      const data = await response.json().catch(() => {
        throw new Error('Invalid response from server');
      });
      return data.content;
    },
    enabled: options?.enabled !== false && !!workspaceId && !!owner && !!repo && !!skillPath,
    retry: false,
  });
};

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
  // Remove trailing slash if present
  cleanSource = cleanSource.replace(/\/$/, '');

  const parts = cleanSource.split('/').filter(Boolean);

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
