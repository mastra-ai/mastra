import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  ArtifactListing,
  DirectoryListing,
  WorkspaceChanges,
  WorkspaceDiff,
  WorkspaceFile,
  WorkspaceRenderedListing,
} from '../api/types';

/**
 * Server-driven directory listing for the project picker (mirrors
 * `GET /web/fs/list`). The browser can't read absolute filesystem paths, so
 * the server enumerates directories confined to its configured root. An absent
 * `path` lists the root; the cache is keyed by `path` so navigating between
 * folders yields distinct entries and React Query dedupes revisits.
 */
export function useDirectoryListing(path: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<DirectoryListing>({
    queryKey: queryKeys.fsList(path),
    placeholderData: previousData => previousData,
    queryFn: () => {
      const qs = path ? `?path=${encodeURIComponent(path)}` : '';
      return client.get<DirectoryListing>(`/web/fs/list${qs}`);
    },
  });
}

export function useArtifactListing(path: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<ArtifactListing>({
    queryKey: queryKeys.artifactsList(path),
    queryFn: path
      ? () => client.get<ArtifactListing>(`/web/artifacts/list?path=${encodeURIComponent(path)}`)
      : skipToken,
  });
}

export function useWorkspaceRenderedListing(
  workspacePath: string | undefined,
  renderedRoot: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceRenderedListing>({
    queryKey: queryKeys.workspaceRenderedList(workspacePath, renderedRoot),
    enabled: options.enabled ?? true,
    queryFn:
      workspacePath && renderedRoot
        ? () =>
            client.get<WorkspaceRenderedListing>(
              `/web/workspace/rendered/list?workspacePath=${encodeURIComponent(workspacePath)}&root=${encodeURIComponent(renderedRoot)}`,
            )
        : skipToken,
  });
}

export function useWorkspaceFile(
  workspacePath: string | undefined,
  filePath: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceFile>({
    queryKey: queryKeys.workspaceFile(workspacePath, filePath),
    enabled: options.enabled ?? true,
    queryFn:
      workspacePath && filePath
        ? () =>
            client.get<WorkspaceFile>(
              `/web/workspace/file?workspacePath=${encodeURIComponent(workspacePath)}&path=${encodeURIComponent(filePath)}`,
            )
        : skipToken,
  });
}

export function useWorkspaceChanges(workspacePath: string | undefined, options: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceChanges>({
    queryKey: queryKeys.workspaceChanges(workspacePath),
    enabled: options.enabled ?? true,
    queryFn: workspacePath
      ? () => client.get<WorkspaceChanges>(`/web/workspace/changes?workspacePath=${encodeURIComponent(workspacePath)}`)
      : skipToken,
  });
}

export function useWorkspaceDiff(
  workspacePath: string | undefined,
  filePath: string | undefined,
  previousFilePath?: string,
  options: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceDiff>({
    queryKey: queryKeys.workspaceDiff(workspacePath, filePath, previousFilePath),
    enabled: options.enabled ?? true,
    queryFn:
      workspacePath && filePath
        ? () => {
            const previousPathQuery = previousFilePath ? `&previousPath=${encodeURIComponent(previousFilePath)}` : '';
            return client.get<WorkspaceDiff>(
              `/web/workspace/changes/diff?workspacePath=${encodeURIComponent(workspacePath)}&path=${encodeURIComponent(filePath)}${previousPathQuery}`,
            );
          }
        : skipToken,
  });
}
