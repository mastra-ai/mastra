import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

// Type definitions for Knowledge API
export interface KnowledgeNamespace {
  namespace: string;
  description?: string;
  artifactCount: number;
  createdAt: string;
  updatedAt: string;
  hasBM25: boolean;
  hasVector: boolean;
}

export interface KnowledgeArtifact {
  key: string;
  type: 'text' | 'file' | 'image';
  size?: number;
  mimeType?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ListArtifactsResponse {
  artifacts: KnowledgeArtifact[];
  namespace: string;
}

export interface GetArtifactResponse {
  key: string;
  content: string;
  type: 'text' | 'file' | 'image';
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  key: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  mode: 'vector' | 'bm25' | 'hybrid';
  namespace: string;
}

// Helper to get base URL from client
const getBaseUrl = (client: ReturnType<typeof useMastraClient>): string => {
  // Access the internal options
  return (client as unknown as { options: { baseUrl: string } }).options?.baseUrl || '';
};

// Helper to make requests directly
const knowledgeRequest = async <T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> => {
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

export const useKnowledgeNamespaces = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['knowledge', 'namespaces'],
    queryFn: async (): Promise<{ namespaces: KnowledgeNamespace[]; isKnowledgeConfigured: boolean }> => {
      return knowledgeRequest(baseUrl, '/api/knowledge/namespaces');
    },
  });
};

export const useKnowledgeArtifacts = (namespace: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['knowledge', 'artifacts', namespace],
    queryFn: async (): Promise<ListArtifactsResponse> => {
      return knowledgeRequest(baseUrl, `/api/knowledge/namespaces/${encodeURIComponent(namespace)}/artifacts`);
    },
    enabled: options?.enabled !== false && !!namespace,
  });
};

export const useKnowledgeArtifact = (namespace: string, artifactKey: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['knowledge', 'artifact', namespace, artifactKey],
    queryFn: async (): Promise<GetArtifactResponse> => {
      return knowledgeRequest(
        baseUrl,
        `/api/knowledge/namespaces/${encodeURIComponent(namespace)}/artifacts/${encodeURIComponent(artifactKey)}`,
      );
    },
    enabled: options?.enabled !== false && !!namespace && !!artifactKey,
  });
};

export interface VectorConfig {
  vectorStoreName?: string;
  indexName?: string;
  embedderName?: string;
}

export interface CreateNamespaceParams {
  namespace: string;
  description?: string;
  enableBM25?: boolean;
  vectorConfig?: VectorConfig;
}

export const useCreateKnowledgeNamespace = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateNamespaceParams): Promise<KnowledgeNamespace> => {
      return knowledgeRequest(baseUrl, '/api/knowledge/namespaces', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'namespaces'] });
    },
  });
};

export const useDeleteKnowledgeNamespace = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (namespace: string): Promise<{ success: boolean; namespace: string }> => {
      return knowledgeRequest(baseUrl, `/api/knowledge/namespaces/${encodeURIComponent(namespace)}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'namespaces'] });
    },
  });
};

export interface AddTextArtifactParams {
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  skipIndex?: boolean;
}

export interface AddFileArtifactParams {
  key: string;
  file: File;
  metadata?: Record<string, unknown>;
  skipIndex?: boolean;
}

export const useAddKnowledgeArtifact = (namespace: string) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddTextArtifactParams): Promise<{ success: boolean; key: string }> => {
      return knowledgeRequest(baseUrl, `/api/knowledge/namespaces/${encodeURIComponent(namespace)}/artifacts`, {
        method: 'POST',
        body: JSON.stringify({
          key: params.key,
          content: params.content,
          metadata: params.metadata,
          skipIndex: params.skipIndex,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'artifacts', namespace] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'namespaces'] });
    },
  });
};

export const useAddKnowledgeFileArtifact = (namespace: string) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddFileArtifactParams): Promise<{ success: boolean; key: string }> => {
      // Convert file to base64
      const arrayBuffer = await params.file.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

      return knowledgeRequest(baseUrl, `/api/knowledge/namespaces/${encodeURIComponent(namespace)}/artifacts/file`, {
        method: 'POST',
        body: JSON.stringify({
          key: params.key,
          filename: params.file.name,
          mimeType: params.file.type || 'application/octet-stream',
          content: base64,
          metadata: params.metadata,
          skipIndex: params.skipIndex,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'artifacts', namespace] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'namespaces'] });
    },
  });
};

export const useDeleteKnowledgeArtifact = (namespace: string) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (artifactKey: string): Promise<{ success: boolean; key: string }> => {
      return knowledgeRequest(
        baseUrl,
        `/api/knowledge/namespaces/${encodeURIComponent(namespace)}/artifacts/${encodeURIComponent(artifactKey)}`,
        {
          method: 'DELETE',
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'artifacts', namespace] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'namespaces'] });
    },
  });
};

export const useSearchKnowledge = (namespace: string) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useMutation({
    mutationFn: async (params: {
      query: string;
      topK?: number;
      mode?: 'vector' | 'bm25' | 'hybrid';
    }): Promise<SearchResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set('query', params.query);
      if (params.topK !== undefined) searchParams.set('topK', String(params.topK));
      if (params.mode) searchParams.set('mode', params.mode);

      return knowledgeRequest(
        baseUrl,
        `/api/knowledge/namespaces/${encodeURIComponent(namespace)}/search?${searchParams.toString()}`,
      );
    },
  });
};
