import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface WorkspaceCapabilities {
  hasFilesystem: boolean;
  hasSandbox: boolean;
  canBM25: boolean;
  canVector: boolean;
  canHybrid: boolean;
  hasSkills: boolean;
}

export interface WorkspaceInfo {
  isWorkspaceConfigured: boolean;
  id?: string;
  name?: string;
  status?: string;
  capabilities?: WorkspaceCapabilities;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface FileReadResponse {
  path: string;
  content: string;
  type: 'file' | 'directory';
  size?: number;
  mimeType?: string;
}

export interface FileListResponse {
  path: string;
  entries: FileEntry[];
}

export interface FileStatResponse {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
  mimeType?: string;
}

export interface SearchResult {
  id: string;
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

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  mode: 'bm25' | 'vector' | 'hybrid';
}

// =============================================================================
// Helper Functions
// =============================================================================

const getBaseUrl = (client: ReturnType<typeof useMastraClient>): string => {
  return (client as unknown as { options: { baseUrl: string } }).options?.baseUrl || '';
};

const workspaceRequest = async <T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> => {
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
// Workspace Info Hook
// =============================================================================

export const useWorkspaceInfo = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'info'],
    queryFn: async (): Promise<WorkspaceInfo> => {
      return workspaceRequest(baseUrl, '/api/workspace');
    },
  });
};

// =============================================================================
// Filesystem Hooks
// =============================================================================

export const useWorkspaceFiles = (path: string, options?: { enabled?: boolean; recursive?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'files', path, options?.recursive],
    queryFn: async (): Promise<FileListResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set('path', path);
      if (options?.recursive) {
        searchParams.set('recursive', 'true');
      }
      return workspaceRequest(baseUrl, `/api/workspace/fs/list?${searchParams.toString()}`);
    },
    enabled: options?.enabled !== false && !!path,
  });
};

export const useWorkspaceFile = (path: string, options?: { enabled?: boolean; encoding?: string }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'file', path],
    queryFn: async (): Promise<FileReadResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set('path', path);
      if (options?.encoding) {
        searchParams.set('encoding', options.encoding);
      }
      return workspaceRequest(baseUrl, `/api/workspace/fs/read?${searchParams.toString()}`);
    },
    enabled: options?.enabled !== false && !!path,
  });
};

export const useWorkspaceFileStat = (path: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useQuery({
    queryKey: ['workspace', 'stat', path],
    queryFn: async (): Promise<FileStatResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set('path', path);
      return workspaceRequest(baseUrl, `/api/workspace/fs/stat?${searchParams.toString()}`);
    },
    enabled: options?.enabled !== false && !!path,
  });
};

export interface WriteFileParams {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  recursive?: boolean;
}

export const useWriteWorkspaceFile = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: WriteFileParams): Promise<{ success: boolean; path: string }> => {
      return workspaceRequest(baseUrl, '/api/workspace/fs/write', {
        method: 'POST',
        body: JSON.stringify({
          path: params.path,
          content: params.content,
          encoding: params.encoding || 'utf-8',
          recursive: params.recursive ?? true,
        }),
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the parent directory listing
      const parentPath = variables.path.split('/').slice(0, -1).join('/') || '/';
      queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'file', variables.path] });
    },
  });
};

export interface WriteFileFromFileParams {
  path: string;
  file: File;
  recursive?: boolean;
}

export const useWriteWorkspaceFileFromFile = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: WriteFileFromFileParams): Promise<{ success: boolean; path: string }> => {
      // Convert file to base64
      const arrayBuffer = await params.file.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

      return workspaceRequest(baseUrl, '/api/workspace/fs/write', {
        method: 'POST',
        body: JSON.stringify({
          path: params.path,
          content: base64,
          encoding: 'base64',
          recursive: params.recursive ?? true,
        }),
      });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/') || '/';
      queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'file', variables.path] });
    },
  });
};

export const useDeleteWorkspaceFile = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      path: string;
      recursive?: boolean;
      force?: boolean;
    }): Promise<{ success: boolean; path: string }> => {
      const searchParams = new URLSearchParams();
      searchParams.set('path', params.path);
      if (params.recursive) searchParams.set('recursive', 'true');
      if (params.force) searchParams.set('force', 'true');

      return workspaceRequest(baseUrl, `/api/workspace/fs/delete?${searchParams.toString()}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/') || '/';
      queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'file', variables.path] });
    },
  });
};

export const useCreateWorkspaceDirectory = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { path: string; recursive?: boolean }): Promise<{ success: boolean; path: string }> => {
      return workspaceRequest(baseUrl, '/api/workspace/fs/mkdir', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/') || '/';
      queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
    },
  });
};

// =============================================================================
// Search Hooks
// =============================================================================

export interface SearchWorkspaceParams {
  query: string;
  topK?: number;
  mode?: 'bm25' | 'vector' | 'hybrid';
  minScore?: number;
}

export const useSearchWorkspace = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useMutation({
    mutationFn: async (params: SearchWorkspaceParams): Promise<SearchResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set('query', params.query);
      if (params.topK !== undefined) searchParams.set('topK', String(params.topK));
      if (params.mode) searchParams.set('mode', params.mode);
      if (params.minScore !== undefined) searchParams.set('minScore', String(params.minScore));

      return workspaceRequest(baseUrl, `/api/workspace/search?${searchParams.toString()}`);
    },
  });
};

export const useIndexWorkspaceContent = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useMutation({
    mutationFn: async (params: {
      path: string;
      content: string;
      metadata?: Record<string, unknown>;
    }): Promise<{ success: boolean; path: string }> => {
      return workspaceRequest(baseUrl, '/api/workspace/index', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  });
};

export const useUnindexWorkspaceContent = () => {
  const client = useMastraClient();
  const baseUrl = getBaseUrl(client);

  return useMutation({
    mutationFn: async (path: string): Promise<{ success: boolean; path: string }> => {
      const searchParams = new URLSearchParams();
      searchParams.set('path', path);

      return workspaceRequest(baseUrl, `/api/workspace/unindex?${searchParams.toString()}`, {
        method: 'DELETE',
      });
    },
  });
};
