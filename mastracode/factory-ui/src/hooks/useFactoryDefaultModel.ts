import type { ModelPackSet } from '@mastra/factory/model-packs';
import {
  queryOptions,
  skipToken,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  applyFactoryDefaultModelToSessions,
  fetchFactoryProject,
  updateFactoryProject,
} from '../ui/domains/workspaces/services/github';
import type { FactoryModelScope } from '../ui/domains/workspaces/services/github';

/**
 * The Factory's org-wide default model. Factory runs (issue triage, board
 * work-item runs) start on this model; per-session model switching still
 * applies afterwards. Server state on the `factory_projects` row — not
 * browser/session state — so both hooks are keyed by `factoryProjectId`.
 */
export function factoryProjectQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.factoryProject(factoryProjectId),
    queryFn: factoryProjectId ? () => fetchFactoryProject(baseUrl, factoryProjectId) : skipToken,
  });
}

export function useFactoryProjectQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(factoryProjectQueryOptions(baseUrl, factoryProjectId));
}

export function useSetFactoryModelPacksMutation(factoryProjectId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (set: ModelPackSet) => updateFactoryProject(baseUrl, factoryProjectId, set),
    onSuccess: project => {
      queryClient.setQueryData(queryKeys.factoryProject(factoryProjectId), project);
      return queryClient.invalidateQueries({ queryKey: queryKeys.availableModels({ factoryProjectId }) });
    },
  });
}

const modelScopeMutationKey = (factoryProjectId: string | undefined) =>
  ['factory', 'project', factoryProjectId ?? null, 'model-scope'] as const;

export function useSetFactoryModelScopeMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: modelScopeMutationKey(factoryProjectId),
    mutationFn: (modelScope: FactoryModelScope) => updateFactoryProject(baseUrl, factoryProjectId!, { modelScope }),
    onSuccess: project => {
      queryClient.setQueryData(queryKeys.factoryProject(factoryProjectId), project);
      // The scope picks which credentials serve this Factory's models, voice input included.
      void queryClient.invalidateQueries({ queryKey: queryKeys.availableModels({ factoryProjectId }) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.voiceSettingsAll() });
    },
  });
}

/** The scope this Factory is being saved to, read from the mutation cache so it survives a remount. */
export function usePendingFactoryModelScope(factoryProjectId: string | undefined) {
  return useMutationState({
    filters: { mutationKey: modelScopeMutationKey(factoryProjectId), status: 'pending' },
    select: mutation => mutation.state.variables as FactoryModelScope,
  }).at(-1);
}

export function useApplyFactoryDefaultModelMutation(factoryProjectId: string) {
  const { baseUrl } = useApiConfig();
  return useMutation({
    mutationFn: () => applyFactoryDefaultModelToSessions(baseUrl, factoryProjectId),
  });
}
