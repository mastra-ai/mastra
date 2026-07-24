import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ArtifactListing, DirectoryListing, WorkspaceFile, WorkspaceRenderedListing } from '../api/types';

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
    enabled: Boolean(path),
    queryFn: () => client.get<ArtifactListing>(`/web/artifacts/list?path=${encodeURIComponent(path ?? '')}`),
  });
}

export function useWorkspaceRenderedListing(workspacePath: string | undefined, renderedRoot: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceRenderedListing>({
    queryKey: queryKeys.workspaceRenderedList(workspacePath, renderedRoot),
    enabled: Boolean(workspacePath && renderedRoot),
    // Controller mutation and run-completion events invalidate this query.
    // Reuse that fresh result across observers and refresh when the tab returns.
    staleTime: Infinity,
    refetchOnWindowFocus: 'always',
    queryFn: () =>
      client.get<WorkspaceRenderedListing>(
        `/web/workspace/rendered/list?workspacePath=${encodeURIComponent(workspacePath ?? '')}&root=${encodeURIComponent(renderedRoot ?? '')}`,
      ),
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
    enabled: Boolean(workspacePath && filePath && (options.enabled ?? true)),
    queryFn: () =>
      client.get<WorkspaceFile>(
        `/web/workspace/file?workspacePath=${encodeURIComponent(workspacePath ?? '')}&path=${encodeURIComponent(filePath ?? '')}`,
      ),
  });
}
