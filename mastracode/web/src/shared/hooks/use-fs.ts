import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  ArtifactListing,
  DirectoryListing,
  WorkspaceFile,
  WorkspacePlan,
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
    enabled: Boolean(path),
    queryFn: () => client.get<ArtifactListing>(`/web/artifacts/list?path=${encodeURIComponent(path ?? '')}`),
  });
}

export function useWorkspaceRenderedListing(workspacePath: string | undefined, renderedRoot: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<WorkspaceRenderedListing>({
    queryKey: queryKeys.workspaceRenderedList(workspacePath, renderedRoot),
    enabled: Boolean(workspacePath && renderedRoot),
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

/**
 * Load the plan markdown a `submit_plan` call points at (mirrors `GET /web/plan`).
 * `planPath` is the path from the tool's args; the server reads it confined to
 * the workspace's `.mastracode/plans/` directory so the approval card can render
 * the plan body rather than just its filename.
 */
export function usePlanFile(
  workspacePath: string | undefined,
  planPath: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  return useQuery<WorkspacePlan>({
    queryKey: queryKeys.workspacePlan(workspacePath, planPath),
    enabled: Boolean(workspacePath && planPath && (options.enabled ?? true)),
    queryFn: () =>
      client.get<WorkspacePlan>(
        `/web/plan?workspacePath=${encodeURIComponent(workspacePath ?? '')}&path=${encodeURIComponent(planPath ?? '')}`,
      ),
  });
}
