import type { RouteResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export type SkillsShSearchResponse = RouteResponse<'GET /workspaces/:workspaceId/skills-sh/search'>;
export type SkillsShListResponse = RouteResponse<'GET /workspaces/:workspaceId/skills-sh/popular'>;
export type SkillsShPreviewResponse = RouteResponse<'GET /workspaces/:workspaceId/skills-sh/preview'>;

export type SkillsShSkill = SkillsShListResponse['skills'][number];

const skillsShPath = (workspaceId: string, route: string, params: Record<string, string>) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/skills-sh/${route}?${new URLSearchParams(params)}`;

/**
 * Search skills on skills.sh (via server proxy)
 */
export const useSearchSkillsSh = (
  workspaceId: string | undefined,
): UseMutationResult<SkillsShSearchResponse, Error, string> => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: (query: string): Promise<SkillsShSearchResponse> => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      return client.request<SkillsShSearchResponse>(skillsShPath(workspaceId, 'search', { q: query, limit: '10' }));
    },
  });
};

/**
 * Get popular skills from skills.sh (via server proxy, cached for 5 minutes)
 */
export const usePopularSkillsSh = (workspaceId: string | undefined): UseQueryResult<SkillsShListResponse> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['skills-sh', 'popular', workspaceId],
    queryFn: (): Promise<SkillsShListResponse> => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      return client.request<SkillsShListResponse>(skillsShPath(workspaceId, 'popular', { limit: '10', offset: '0' }));
    },
    staleTime: 5 * 60 * 1000,
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
    queryFn: async () => {
      if (!workspaceId || !owner || !repo || !skillPath) {
        throw new Error('workspaceId, owner, repo, and skillPath are required');
      }
      const data = await client.request<SkillsShPreviewResponse>(
        skillsShPath(workspaceId, 'preview', { owner, repo, path: skillPath }),
        { retries: 0 },
      );
      return data.content;
    },
    enabled: options?.enabled !== false && !!workspaceId && !!owner && !!repo && !!skillPath,
    retry: false,
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
  const [owner, repo] = parts;

  if (!owner || !repo) {
    return null;
  }

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
