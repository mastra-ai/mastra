import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { MastraClient,SkillsShSkill } from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export type { SkillsShSkill };

type SearchSkillsShResponse = Awaited<ReturnType<ReturnType<MastraClient['getWorkspace']>['searchSkillsSh']>>;
type PopularSkillsShResponse = Awaited<ReturnType<ReturnType<MastraClient['getWorkspace']>['listPopularSkillsSh']>>;
type InstallSkillsShResponse = Awaited<ReturnType<ReturnType<MastraClient['getWorkspace']>['installSkillsSh']>>;
type UpdateSkillsShResponse = Awaited<ReturnType<ReturnType<MastraClient['getWorkspace']>['updateSkillsSh']>>;
type RemoveSkillsShResponse = Awaited<ReturnType<ReturnType<MastraClient['getWorkspace']>['removeSkillsSh']>>;

/**
 * Search skills on skills.sh (via server proxy)
 */
export const useSearchSkillsSh = ({
  workspaceId,
  queryOptions,
}: {
  workspaceId: string | undefined;
  queryOptions?: MastraMutationOptions<SearchSkillsShResponse, string>;
}): UseMutationResult<SearchSkillsShResponse, Error, string> => {
  const client = useMastraClient();

  return useMutation<SearchSkillsShResponse, Error, string>({
    mutationFn: (query: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      return client.getWorkspace(workspaceId).searchSkillsSh({ q: query, limit: 10 });
    },
    ...queryOptions,
  });
};

/**
 * Get popular skills from skills.sh (via server proxy, cached for 5 minutes)
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const usePopularSkillsSh = <TData = PopularSkillsShResponse>({
  workspaceId,
  queryOptions,
}: {
  workspaceId: string | undefined;
  queryOptions?: MastraQueryOptions<PopularSkillsShResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<PopularSkillsShResponse, Error, TData>({
    queryKey: ['skills-sh', 'popular', workspaceId],
    queryFn: () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      return client.getWorkspace(workspaceId).listPopularSkillsSh({ limit: 10, offset: 0 });
    },
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  });
};

/**
 * Preview a skill by fetching its SKILL.md (via server proxy to avoid CORS)
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useSkillPreview = <TData = string>({
  workspaceId,
  owner,
  repo,
  skillPath,
  queryOptions,
}: {
  workspaceId: string | undefined;
  owner: string | undefined;
  repo: string | undefined;
  skillPath: string | undefined;
  queryOptions?: MastraQueryOptions<string, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<string, Error, TData>({
    queryKey: ['skills-sh', 'preview', workspaceId, owner, repo, skillPath],
    queryFn: async () => {
      if (!workspaceId || !owner || !repo || !skillPath) {
        throw new Error('workspaceId, owner, repo, and skillPath are required');
      }
      const { content } = await client.getWorkspace(workspaceId).previewSkillsSh({ owner, repo, path: skillPath });
      return content;
    },
    retry: false,
    ...queryOptions,
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
export const useInstallSkill = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<InstallSkillsShResponse, InstallSkillParams> } = {}) => {
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
    ...queryOptions,
  });
};

export interface UpdateSkillsParams {
  workspaceId: string;
  skillName?: string;
}

/**
 * Update installed skills by re-fetching from GitHub.
 */
export const useUpdateSkills = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<UpdateSkillsShResponse, UpdateSkillsParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateSkillsParams) =>
      client.getWorkspace(params.workspaceId).updateSkillsSh({ skillName: params.skillName }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
    ...queryOptions,
  });
};

export interface RemoveSkillParams {
  workspaceId: string;
  skillName: string;
}

/**
 * Remove an installed skill by deleting its directory.
 */
export const useRemoveSkill = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<RemoveSkillsShResponse, RemoveSkillParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: RemoveSkillParams) =>
      client.getWorkspace(params.workspaceId).removeSkillsSh({ skillName: params.skillName }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
    },
    ...queryOptions,
  });
};
