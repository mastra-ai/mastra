import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchRepositorySettings, saveRepositorySettings } from '../../web/ui/domains/workspaces/services/github';
import type { RepositorySettings } from '../../web/ui/domains/workspaces/services/github';

/**
 * Per-repository settings (worktree setup command) through the shared React Query
 * cache. Gated on a `githubProjectId` — local factories have no server-side
 * settings, so the query stays idle for them.
 */
export function useRepositorySettingsQuery(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubRepositorySettings(githubProjectId),
    queryFn: () => fetchRepositorySettings(baseUrl, githubProjectId!),
    enabled: Boolean(githubProjectId),
  });
}

/** Persist a repository's settings and refresh the cached copy. */
export function useSaveRepositorySettingsMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ githubProjectId, settings }: { githubProjectId: string; settings: RepositorySettings }) =>
      saveRepositorySettings(baseUrl, githubProjectId, settings),
    onSuccess: (saved, { githubProjectId }) => {
      queryClient.setQueryData(queryKeys.githubRepositorySettings(githubProjectId), saved);
    },
  });
}
