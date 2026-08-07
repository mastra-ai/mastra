import { skipToken, useQuery } from '@tanstack/react-query';

import type { ApiClient } from '../api/client';
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

/** An undefined url means a required param is still missing, so the query stays idle instead of firing a broken request. */
function getOrSkip<T>(client: ApiClient, url: string | undefined) {
  if (!url) return skipToken;
  return () => client.get<T>(url);
}

function directoryListingUrl(path: string | undefined) {
  if (!path) return '/web/fs/list';
  return `/web/fs/list?${new URLSearchParams({ path })}`;
}

function artifactListingUrl(path: string | undefined) {
  if (!path) return undefined;
  return `/web/artifacts/list?${new URLSearchParams({ path })}`;
}

function workspaceRenderedListingUrl(workspacePath: string | undefined, root: string | undefined) {
  if (!workspacePath || !root) return undefined;
  return `/web/workspace/rendered/list?${new URLSearchParams({ workspacePath, root })}`;
}

function workspaceFileUrl(workspacePath: string | undefined, path: string | undefined) {
  if (!workspacePath || !path) return undefined;
  return `/web/workspace/file?${new URLSearchParams({ workspacePath, path })}`;
}

function workspaceChangesUrl(workspacePath: string | undefined) {
  if (!workspacePath) return undefined;
  return `/web/workspace/changes?${new URLSearchParams({ workspacePath })}`;
}

function workspaceDiffUrl(
  workspacePath: string | undefined,
  path: string | undefined,
  previousPath: string | undefined,
) {
  if (!workspacePath || !path) return undefined;
  const params = new URLSearchParams({ workspacePath, path });
  if (previousPath) params.set('previousPath', previousPath);
  return `/web/workspace/changes/diff?${params}`;
}

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
    queryFn: () => client.get<DirectoryListing>(directoryListingUrl(path)),
  });
}

export function useArtifactListing(path: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<ArtifactListing>({
    queryKey: queryKeys.artifactsList(path),
    queryFn: getOrSkip<ArtifactListing>(client, artifactListingUrl(path)),
  });
}

export function useWorkspaceRenderedListing(
  workspacePath: string | undefined,
  renderedRoot: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceRenderedListing>({
    queryKey: queryKeys.workspaceRenderedList(workspacePath, renderedRoot),
    enabled,
    queryFn: getOrSkip<WorkspaceRenderedListing>(client, workspaceRenderedListingUrl(workspacePath, renderedRoot)),
  });
}

export function useWorkspaceFile(
  workspacePath: string | undefined,
  filePath: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceFile>({
    queryKey: queryKeys.workspaceFile(workspacePath, filePath),
    enabled,
    queryFn: getOrSkip<WorkspaceFile>(client, workspaceFileUrl(workspacePath, filePath)),
  });
}

export function useWorkspaceChanges(workspacePath: string | undefined, { enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceChanges>({
    queryKey: queryKeys.workspaceChanges(workspacePath),
    enabled,
    queryFn: getOrSkip<WorkspaceChanges>(client, workspaceChangesUrl(workspacePath)),
  });
}

export function useWorkspaceDiff(
  workspacePath: string | undefined,
  filePath: string | undefined,
  previousFilePath?: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceDiff>({
    queryKey: queryKeys.workspaceDiff(workspacePath, filePath, previousFilePath),
    enabled,
    queryFn: getOrSkip<WorkspaceDiff>(client, workspaceDiffUrl(workspacePath, filePath, previousFilePath)),
  });
}
