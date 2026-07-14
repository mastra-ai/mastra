import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { fetchProjectSettings, saveProjectSettings } from '../services/github';
import type { ProjectSettings } from '../services/github';

/**
 * Per-project settings (worktree setup command) through the shared React Query
 * cache. Gated on a `githubProjectId` — local projects have no server-side
 * settings, so the query stays idle for them.
 */
export function useProjectSettingsQuery(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubProjectSettings(githubProjectId),
    queryFn: () => fetchProjectSettings(baseUrl, githubProjectId!),
    enabled: Boolean(githubProjectId),
  });
}

/** Persist a project's settings and refresh the cached copy. */
export function useSaveProjectSettingsMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ githubProjectId, settings }: { githubProjectId: string; settings: ProjectSettings }) =>
      saveProjectSettings(baseUrl, githubProjectId, settings),
    onSuccess: (saved, { githubProjectId }) => {
      queryClient.setQueryData(queryKeys.githubProjectSettings(githubProjectId), saved);
    },
  });
}
