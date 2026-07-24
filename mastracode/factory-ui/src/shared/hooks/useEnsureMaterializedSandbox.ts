import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { PrepareProgress } from '../../web/ui/domains/workspaces/services/github';
import { ensureRepoMaterialized } from '../../web/ui/domains/workspaces/services/github';

export function useEnsureMaterializedSandbox(projectRepositoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.ensureSandbox(projectRepositoryId),
    queryFn: () =>
      ensureRepoMaterialized(baseUrl, projectRepositoryId!, event => {
        queryClient.setQueryData<PrepareProgress>(queryKeys.ensureSandboxProgress(projectRepositoryId), event);
      }),
    enabled: Boolean(projectRepositoryId),
    staleTime: Infinity,
    retry: false,
  });
}

export function useEnsureProgress(projectRepositoryId: string | undefined) {
  return useQuery<PrepareProgress | undefined>({
    queryKey: queryKeys.ensureSandboxProgress(projectRepositoryId),
    queryFn: () => undefined,
    enabled: false,
  });
}
