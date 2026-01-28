import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { hasMethod } from '../client-utils';
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

// =============================================================================
// Workspace Info Hook
// =============================================================================

export const useWorkspaceInfo = (workspaceId?: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'info', workspaceId],
    queryFn: async (): Promise<WorkspaceInfo> => {
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
      }
      if (!workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(workspaceId);
      return workspace.info();
    },
    enabled: !!workspaceId && hasMethod(client, 'getWorkspace'),
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
      if (!hasMethod(client, 'listWorkspaces')) {
        throw new Error('Client does not support listWorkspaces');
      }
      return (client as any).listWorkspaces();
    },
    enabled: hasMethod(client, 'listWorkspaces'),
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
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      return workspace.listFiles(path, options?.recursive);
    },
    enabled: options?.enabled !== false && !!path && !!options?.workspaceId && hasMethod(client, 'getWorkspace'),
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
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      return workspace.readFile(path, options?.encoding);
    },
    enabled: options?.enabled !== false && !!path && !!options?.workspaceId && hasMethod(client, 'getWorkspace'),
  });
};

export const useWorkspaceFileStat = (path: string, options?: { enabled?: boolean; workspaceId?: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workspace', 'stat', path, options?.workspaceId],
    queryFn: async (): Promise<FileStatResponse> => {
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
      }
      if (!options?.workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(options.workspaceId);
      return workspace.stat(path);
    },
    enabled: options?.enabled !== false && !!path && !!options?.workspaceId && hasMethod(client, 'getWorkspace'),
  });
};

export const useWriteWorkspaceFile = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: WriteFileParams) => {
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
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
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
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
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
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
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
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
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
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
    mutationFn: async (params: {
      workspaceId: string;
      path: string;
      content: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!hasMethod(client, 'getWorkspace')) {
        throw new Error('Client does not support workspace methods');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.index({
        path: params.path,
        content: params.content,
        metadata: params.metadata,
      });
    },
  });
};
