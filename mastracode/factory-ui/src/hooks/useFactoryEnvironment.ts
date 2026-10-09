import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { getFactoryEnvironment, patchFactoryEnvironment } from '../ui/domains/workspaces/services/environment';
import type { FactoryEnvironmentPatch } from '../ui/domains/workspaces/services/environment';

/**
 * A Factory's environment (resources, ordered repositories and setup) through
 * the shared React Query cache. Idle without a factory id.
 */
export function useFactoryEnvironmentQuery(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryEnvironment(factoryId),
    queryFn: () => getFactoryEnvironment(baseUrl, factoryId!),
    enabled: Boolean(factoryId),
  });
}

/**
 * Persist environment changes. The response carries the whole environment, so
 * the cache is replaced from it and then refetched: the PATCH is not
 * transactional, so a half-applied save shows up as what the server really
 * holds. The factory query is invalidated because its repository list mirrors
 * part of the environment.
 */
export function useSaveFactoryEnvironmentMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId, input }: { factoryId: string; input: FactoryEnvironmentPatch }) =>
      patchFactoryEnvironment(baseUrl, factoryId, input),
    onSuccess: (saved, { factoryId }) => {
      queryClient.setQueryData(queryKeys.factoryEnvironment(factoryId), saved.environment);
      void queryClient.invalidateQueries({ queryKey: queryKeys.factoryEnvironment(factoryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.factoryProject(factoryId) });
    },
  });
}
