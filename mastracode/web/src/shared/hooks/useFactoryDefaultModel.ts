import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryProject, updateFactoryDefaultModel } from '../../web/ui/domains/workspaces/services/github';

/**
 * The Factory's org-wide default model. Factory runs (issue triage, board
 * work-item runs) start on this model; per-session model switching still
 * applies afterwards. Server state on the `factory_projects` row — not
 * browser/session state — so both hooks are keyed by `factoryProjectId`.
 */
export function useFactoryProjectQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryProject(factoryProjectId),
    queryFn: () => fetchFactoryProject(baseUrl, factoryProjectId!),
    enabled: !!factoryProjectId,
  });
}

export function useSetFactoryDefaultModelMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (defaultModelId: string | null) =>
      updateFactoryDefaultModel(baseUrl, factoryProjectId!, defaultModelId),
    onSuccess: project => {
      queryClient.setQueryData(queryKeys.factoryProject(factoryProjectId), project);
    },
  });
}
