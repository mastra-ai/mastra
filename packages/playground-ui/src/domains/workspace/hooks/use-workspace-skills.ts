import { useQuery, useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

// =============================================================================
// Type Definitions
// =============================================================================

export type SkillSource =
  | { type: 'external'; packagePath: string }
  | { type: 'local'; projectPath: string }
  | { type: 'managed'; mastraPath: string };

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
}

export interface Skill extends SkillMetadata {
  path: string;
  instructions: string;
  source: SkillSource;
  references: string[];
  scripts: string[];
  assets: string[];
}

export interface ListSkillsResponse {
  skills: SkillMetadata[];
  isSkillsConfigured: boolean;
}

export interface SkillSearchResult {
  skillName: string;
  source: string;
  content: string;
  score: number;
  lineRange?: {
    start: number;
    end: number;
  };
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

export interface SearchSkillsResponse {
  results: SkillSearchResult[];
  query: string;
}

export interface ListReferencesResponse {
  skillName: string;
  references: string[];
}

export interface GetReferenceResponse {
  skillName: string;
  referencePath: string;
  content: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const getBaseUrl = (client: ReturnType<typeof useMastraClient>): string => {
  return (client as unknown as { options: { baseUrl: string } }).options?.baseUrl || '';
};

const skillsRequest = async <T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Request failed: ${res.statusText} - ${error}`);
  }
  return res.json();
};

// =============================================================================
// Skills Hooks (via Workspace API)
// =============================================================================

/**
 * Hook to list all discovered skills via workspace
 */
export const useWorkspaceSkills = (options?: { workspaceId?: string }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'skills', options?.workspaceId],
    queryFn: async (): Promise<ListSkillsResponse> => {
      const searchParams = new URLSearchParams();
      if (options?.workspaceId) {
        searchParams.set('workspaceId', options.workspaceId);
      }
      const query = searchParams.toString();
      return skillsRequest(baseUrl, `/api/workspace/skills${query ? `?${query}` : ''}`);
    },
  });
};

/**
 * Hook to get a specific skill's full details via workspace
 */
export const useWorkspaceSkill = (skillName: string, options?: { enabled?: boolean; workspaceId?: string }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'skills', skillName, options?.workspaceId],
    queryFn: async (): Promise<Skill> => {
      const searchParams = new URLSearchParams();
      if (options?.workspaceId) {
        searchParams.set('workspaceId', options.workspaceId);
      }
      const query = searchParams.toString();
      return skillsRequest(
        baseUrl,
        `/api/workspace/skills/${encodeURIComponent(skillName)}${query ? `?${query}` : ''}`,
      );
    },
    enabled: options?.enabled !== false && !!skillName,
  });
};

/**
 * Hook to list references for a skill via workspace
 */
export const useWorkspaceSkillReferences = (skillName: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'skills', skillName, 'references'],
    queryFn: async (): Promise<ListReferencesResponse> => {
      return skillsRequest(baseUrl, `/api/workspace/skills/${encodeURIComponent(skillName)}/references`);
    },
    enabled: options?.enabled !== false && !!skillName,
  });
};

/**
 * Hook to get a specific reference file content via workspace
 */
export const useWorkspaceSkillReference = (
  skillName: string,
  referencePath: string,
  options?: { enabled?: boolean },
) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'skills', skillName, 'references', referencePath],
    queryFn: async (): Promise<GetReferenceResponse> => {
      return skillsRequest(
        baseUrl,
        `/api/workspace/skills/${encodeURIComponent(skillName)}/references/${encodeURIComponent(referencePath)}`,
      );
    },
    enabled: options?.enabled !== false && !!skillName && !!referencePath,
  });
};

export interface SearchSkillsParams {
  query: string;
  topK?: number;
  minScore?: number;
  skillNames?: string[];
  includeReferences?: boolean;
  workspaceId?: string;
}

/**
 * Hook to search across skills via workspace
 */
export const useSearchWorkspaceSkills = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useMutation({
    mutationFn: async (params: SearchSkillsParams): Promise<SearchSkillsResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set('query', params.query);
      if (params.topK !== undefined) searchParams.set('topK', String(params.topK));
      if (params.minScore !== undefined) searchParams.set('minScore', String(params.minScore));
      if (params.skillNames && params.skillNames.length > 0) {
        searchParams.set('skillNames', params.skillNames.join(','));
      }
      if (params.includeReferences !== undefined) {
        searchParams.set('includeReferences', String(params.includeReferences));
      }
      if (params.workspaceId) {
        searchParams.set('workspaceId', params.workspaceId);
      }

      return skillsRequest(baseUrl, `/api/workspace/skills/search?${searchParams.toString()}`);
    },
  });
};

// =============================================================================
// Agent-Specific Skill Hook
// =============================================================================

/**
 * Hook to get a specific skill from an agent's workspace
 */
export const useAgentSkill = (agentId: string, skillName: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['agents', agentId, 'skills', skillName],
    queryFn: async (): Promise<Skill> => {
      return skillsRequest(
        baseUrl,
        `/api/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(skillName)}`,
      );
    },
    enabled: options?.enabled !== false && !!agentId && !!skillName,
  });
};
