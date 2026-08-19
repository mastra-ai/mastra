import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  ArtifactListing,
  DirectoryListing,
  WorkspaceChanges,
  WorkspaceDiff,
  WorkspaceFile,
  WorkspaceFilesListing,
  WorkspaceRenderedListing,
} from '../api/types';

/** A builder returns undefined while a required param is missing, which is what turns its query into a skipToken below. */
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

function workspaceFileUrl(workspacePath: string | undefined, path: string | undefined, threadId: string | undefined) {
  if (!workspacePath || !path || !threadId) return undefined;
  return `/web/workspace/file?${new URLSearchParams({ workspacePath, path, threadId })}`;
}

function planFileUrl(workspacePath: string | undefined, path: string | undefined) {
  if (!workspacePath || !path) return undefined;
  // The session file route only approves `.artifacts/*` reads without a thread
  // file listing; Factory plans always live under `.artifacts/plans/`.
  if (!path.startsWith('.artifacts/')) return undefined;
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
  const url = directoryListingUrl(path);
  return useQuery<DirectoryListing>({
    queryKey: queryKeys.fsList(path),
    placeholderData: previousData => previousData,
    queryFn: () => client.get<DirectoryListing>(url),
  });
}

export function useArtifactListing(path: string | undefined) {
  const { client } = useApiConfig();
  const url = artifactListingUrl(path);
  return useQuery<ArtifactListing>({
    queryKey: queryKeys.artifactsList(path),
    queryFn: url ? () => client.get<ArtifactListing>(url) : skipToken,
  });
}

export function useWorkspaceRenderedListing(
  workspacePath: string | undefined,
  renderedRoot: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = workspaceRenderedListingUrl(workspacePath, renderedRoot);
  return useQuery<WorkspaceRenderedListing>({
    queryKey: queryKeys.workspaceRenderedList(workspacePath, renderedRoot),
    enabled,
    queryFn: url ? () => client.get<WorkspaceRenderedListing>(url) : skipToken,
  });
}

export function useWorkspaceFiles(
  workspacePath: string | undefined,
  threadId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url =
    workspacePath && threadId ? `/web/workspace/files?${new URLSearchParams({ workspacePath, threadId })}` : undefined;
  return useQuery<WorkspaceFilesListing>({
    queryKey: queryKeys.workspaceFiles(workspacePath, threadId),
    enabled,
    queryFn: url ? () => client.get<WorkspaceFilesListing>(url) : skipToken,
  });
}

export function useWorkspaceFile(
  workspacePath: string | undefined,
  filePath: string | undefined,
  threadId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = workspaceFileUrl(workspacePath, filePath, threadId);
  return useQuery<WorkspaceFile>({
    queryKey: queryKeys.workspaceFile(workspacePath, filePath, threadId),
    enabled,
    queryFn: url ? () => client.get<WorkspaceFile>(url) : skipToken,
  });
}

/**
 * Read a submitted plan's markdown from the session workspace. Keyed by
 * `toolCallId` so a plan resubmission (same path, new tool call) fetches the
 * revised file instead of replaying the previous submission from cache.
 */
export function usePlanFile(
  workspacePath: string | undefined,
  path: string | undefined,
  toolCallId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = planFileUrl(workspacePath, path);
  return useQuery<WorkspaceFile>({
    queryKey: queryKeys.planFile(workspacePath, path, toolCallId),
    enabled,
    queryFn: url ? () => client.get<WorkspaceFile>(url) : skipToken,
  });
}

export function useWorkspaceChanges(workspacePath: string | undefined, { enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  const url = workspaceChangesUrl(workspacePath);
  return useQuery<WorkspaceChanges>({
    queryKey: queryKeys.workspaceChanges(workspacePath),
    enabled,
    queryFn: url ? () => client.get<WorkspaceChanges>(url) : skipToken,
  });
}

export function useWorkspaceDiff(
  workspacePath: string | undefined,
  filePath: string | undefined,
  previousFilePath?: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = workspaceDiffUrl(workspacePath, filePath, previousFilePath);
  return useQuery<WorkspaceDiff>({
    queryKey: queryKeys.workspaceDiff(workspacePath, filePath, previousFilePath),
    enabled,
    queryFn: url ? () => client.get<WorkspaceDiff>(url) : skipToken,
  });
}
