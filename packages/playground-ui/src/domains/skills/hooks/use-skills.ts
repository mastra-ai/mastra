import { useQuery, useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

// Type definitions for Skills API
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

// Helper to get base URL from client
const getBaseUrl = (client: ReturnType<typeof useMastraClient>): string => {
  return (client as unknown as { options: { baseUrl: string } }).options?.baseUrl || '';
};

// Helper to make requests directly
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

/**
 * Hook to list all discovered skills
 */
export const useSkills = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['skills'],
    queryFn: async (): Promise<ListSkillsResponse> => {
      return skillsRequest(baseUrl, '/api/skills');
    },
  });
};

/**
 * Hook to get a specific skill's full details
 */
export const useSkill = (skillName: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['skills', skillName],
    queryFn: async (): Promise<Skill> => {
      return skillsRequest(baseUrl, `/api/skills/${encodeURIComponent(skillName)}`);
    },
    enabled: options?.enabled !== false && !!skillName,
  });
};

/**
 * Hook to list references for a skill
 */
export const useSkillReferences = (skillName: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['skills', skillName, 'references'],
    queryFn: async (): Promise<ListReferencesResponse> => {
      return skillsRequest(baseUrl, `/api/skills/${encodeURIComponent(skillName)}/references`);
    },
    enabled: options?.enabled !== false && !!skillName,
  });
};

/**
 * Hook to get a specific reference file content
 */
export const useSkillReference = (skillName: string, referencePath: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['skills', skillName, 'references', referencePath],
    queryFn: async (): Promise<GetReferenceResponse> => {
      return skillsRequest(
        baseUrl,
        `/api/skills/${encodeURIComponent(skillName)}/references/${encodeURIComponent(referencePath)}`,
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
}

/**
 * Hook to search across skills
 */
export const useSearchSkills = () => {
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

      return skillsRequest(baseUrl, `/api/skills/search?${searchParams.toString()}`);
    },
  });
};
