import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { DEFAULT_THINKING_LEVEL } from '@mastra/factory/default-thinking-level';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryProject, updateFactoryThinkingDefault } from '../ui/domains/workspaces/services/github';
import type { FactoryProjectPayload } from '../ui/domains/workspaces/services/github';

/**
 * The Factory's thinking default — what sessions and runs on the Factory defaults use until they
 * pick their own level. Read off the Factory project, sharing its cache entry.
 */
export function useFactoryThinkingDefaultQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryProject(factoryProjectId),
    queryFn: () => fetchFactoryProject(baseUrl, factoryProjectId!),
    enabled: !!factoryProjectId,
    select: (project: FactoryProjectPayload) => project.defaultThinkingLevel ?? DEFAULT_THINKING_LEVEL,
  });
}

/** Optimistic: the slider holds the dropped level, a rejection puts it back. */
export function useSetFactoryThinkingDefaultMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const key = queryKeys.factoryProject(factoryProjectId);

  return useMutation({
    // One write at a time, so a rollback restores the value before that write.
    scope: { id: `factory-thinking-default:${factoryProjectId}` },
    mutationFn: (level: ThinkingLevelSetting) => updateFactoryThinkingDefault(baseUrl, factoryProjectId!, level),
    onMutate: async level => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<FactoryProjectPayload>(key);
      if (previous) queryClient.setQueryData<FactoryProjectPayload>(key, { ...previous, defaultThinkingLevel: level });
      return { previous };
    },
    onError: (_error, _level, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: project =>
      queryClient.setQueryData<FactoryProjectPayload>(key, prev =>
        prev ? { ...prev, defaultThinkingLevel: project.defaultThinkingLevel } : prev,
      ),
  });
}
