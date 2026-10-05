import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';
import { isWorkspaceV1Supported, shouldRetryWorkspaceQuery, isWorkspaceNotSupportedError } from './compatibility';
import type {
  WorkspaceInfo,
  WorkspacesListResponse,
  FileStatResponse,
  WriteFileParams,
  WriteFileFromFileParams,
} from './types';

export type DeleteWorkspaceFileParams = { path: string; recursive?: boolean; force?: boolean; workspaceId?: string };
export type CreateWorkspaceDirectoryParams = { path: string; recursive?: boolean; workspaceId?: string };
export type IndexWorkspaceContentParams = {
  workspaceId: string;
  path: string;
  content: string;
  metadata?: Record<string, unknown>;
};

function getParentPath(path: string): string {
  return path.split('/').slice(0, -1).join('/') || (path.startsWith('/') ? '/' : '.');
}

// Re-export for other hooks to use
export { isWorkspaceV1Supported, isWorkspaceNotSupportedError };

// =============================================================================
// Workspace Info Hook
// =============================================================================

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useWorkspaceInfo = <TData = WorkspaceInfo>({
  workspaceId,
  queryOptions,
}: {
  workspaceId?: string;
  queryOptions?: MastraQueryOptions<WorkspaceInfo, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<WorkspaceInfo, Error, TData>({
    queryKey: ['workspace', 'info', workspaceId],
    queryFn: async (): Promise<WorkspaceInfo> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(workspaceId);
      return workspace.info();
    },
    enabled: isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
    ...queryOptions,
  });
};

// =============================================================================
// List All Workspaces Hook
// =============================================================================

export const useWorkspaces = <TData = WorkspacesListResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<WorkspacesListResponse, TData> } = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<WorkspacesListResponse, Error, TData>({
    queryKey: ['workspaces'],
    queryFn: async (): Promise<WorkspacesListResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      return (client as any).listWorkspaces();
    },
    retry: shouldRetryWorkspaceQuery,
    ...queryOptions,
  });
};

// =============================================================================
// Filesystem Hooks
// =============================================================================

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useWorkspaceFileStat = <TData = FileStatResponse>({
  path,
  workspaceId,
  queryOptions,
}: {
  path: string;
  workspaceId?: string;
  queryOptions?: MastraQueryOptions<FileStatResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<FileStatResponse, Error, TData>({
    queryKey: ['workspace', 'stat', path, workspaceId],
    queryFn: async (): Promise<FileStatResponse> => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      if (!workspaceId) {
        throw new Error('workspaceId is required');
      }
      const workspace = (client as any).getWorkspace(workspaceId);
      return workspace.stat(path);
    },
    enabled: isWorkspaceV1Supported(client),
    retry: shouldRetryWorkspaceQuery,
    ...queryOptions,
  });
};

export const useWriteWorkspaceFile = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<unknown, WriteFileParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, WriteFileParams>({
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
      const parentPath = getParentPath(variables.path);
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'file', variables.path] });
    },
    ...queryOptions,
  });
};

export const useWriteWorkspaceFileFromFile = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<unknown, WriteFileFromFileParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, WriteFileFromFileParams>({
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
      const parentPath = getParentPath(variables.path);
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'file', variables.path] });
    },
    ...queryOptions,
  });
};

export const useDeleteWorkspaceFile = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<unknown, DeleteWorkspaceFileParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, DeleteWorkspaceFileParams>({
    mutationFn: async (params: DeleteWorkspaceFileParams) => {
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
      const parentPath = getParentPath(variables.path);
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'file', variables.path] });
    },
    ...queryOptions,
  });
};

export const useCreateWorkspaceDirectory = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<unknown, CreateWorkspaceDirectoryParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, CreateWorkspaceDirectoryParams>({
    mutationFn: async (params: CreateWorkspaceDirectoryParams) => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.mkdir(params.path, params.recursive);
    },
    onSuccess: (_, variables) => {
      const parentPath = getParentPath(variables.path);
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'files', parentPath] });
    },
    ...queryOptions,
  });
};

// =============================================================================
// Search Hooks
// =============================================================================

export const useIndexWorkspaceContent = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<unknown, IndexWorkspaceContentParams> } = {}) => {
  const client = useMastraClient();

  return useMutation<unknown, Error, IndexWorkspaceContentParams>({
    mutationFn: async (params: IndexWorkspaceContentParams) => {
      if (!isWorkspaceV1Supported(client)) {
        throw new Error('Workspace v1 not supported by core or client');
      }
      const workspace = (client as any).getWorkspace(params.workspaceId);
      return workspace.index({
        path: params.path,
        content: params.content,
        metadata: params.metadata,
      });
    },
    ...queryOptions,
  });
};
