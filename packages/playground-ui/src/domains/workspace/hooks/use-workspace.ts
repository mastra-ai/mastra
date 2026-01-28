import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type {
  WorkspaceInfo,
  WorkspacesListResponse,
  FileListResponse,
  FileReadResponse,
  FileStatResponse,
  WriteFileParams,
  WriteFileFromFileParams,
  SearchWorkspaceParams,
  SearchResponse,
} from '../types';
import { isWorkspaceV1Supported } from '../compatibility';

// =============================================================================
// Workspace Info Hook
// =============================================================================

export const useWorkspaceInfo = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'info'],
    queryFn: async (): Promise<WorkspaceInfo> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace();
      return workspace.info();
    },
    enabled: isWorkspaceV1Supported(client),
  });
};

// =============================================================================
// List All Workspaces Hook
// =============================================================================

export const useWorkspaces = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async (): Promise<WorkspacesListResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      return (client as any).listWorkspaces();
    },
    enabled: isWorkspaceV1Supported(client),
  });
};

// =============================================================================
// Filesystem Hooks
// =============================================================================

export const useWorkspaceFiles = (
  path: string,
  options?: { enabled?: boolean; recursive?: boolean; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'files', path, options?.recursive, options?.workspaceId],
    queryFn: async (): Promise<FileListResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      return workspace.listFiles(path, options?.recursive);
    },
    enabled: options?.enabled !== false && !!path && isWorkspaceV1Supported(client),
  });
};

export const useWorkspaceFile = (
  path: string,
  options?: { enabled?: boolean; encoding?: string; workspaceId?: string },
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'file', path, options?.workspaceId],
    queryFn: async (): Promise<FileReadResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      return workspace.readFile(path, options?.encoding);
    },
    enabled: options?.enabled !== false && !!path && isWorkspaceV1Supported(client),
  });
};

export const useWorkspaceFileStat = (path: string, options?: { enabled?: boolean; workspaceId?: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'stat', path, options?.workspaceId],
    queryFn: async (): Promise<FileStatResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(options?.workspaceId);
      return workspace.stat(path);
    },
    enabled: options?.enabled !== false && !!path && isWorkspaceV1Supported(client),
  });
};

export const useWriteWorkspaceFile = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: WriteFileParams) => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.writeFile(params.path, params.content, {
        encoding: params.encoding,
        recursive: params.recursive ?? true,
      });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/') || '/';
      queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'file', variables.path] });
    },
  });
};

export const useWriteWorkspaceFileFromFile = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: WriteFileFromFileParams) => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      // Convert file to base64
      const arrayBuffer = await params.file.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.writeFile(params.path, base64, {
        encoding: 'base64',
        recursive: params.recursive ?? true,
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { path: string; recursive?: boolean; force?: boolean; workspaceId?: string }) => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.delete(params.path, {
        recursive: params.recursive,
        force: params.force,
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { path: string; recursive?: boolean; workspaceId?: string }) => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.mkdir(params.path, params.recursive);
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

export const useSearchWorkspace = () => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async (params: SearchWorkspaceParams): Promise<SearchResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.search({
        query: params.query,
        topK: params.topK,
        mode: params.mode,
        minScore: params.minScore,
      });
    },
  });
};

export const useIndexWorkspaceContent = () => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async (params: { path: string; content: string; metadata?: Record<string, unknown> }) => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace();
      return workspace.index(params);
    },
  });
};
