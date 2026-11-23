import { DEFAULT_THINKING_LEVEL } from '@mastra/factory/default-thinking-level';
import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryProject, updateFactoryProject } from '../ui/domains/workspaces/services/github';
import type { FactoryProjectPayload } from '../ui/domains/workspaces/services/github';
import { useOptimisticFieldWrite } from './optimistic-field-write';

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
export function useSetFactoryThinkingDefaultMutation(factoryProjectId: string) {
  const { baseUrl } = useApiConfig();
  return useOptimisticFieldWrite<FactoryProjectPayload, 'defaultThinkingLevel', FactoryProjectPayload>({
    queryKey: queryKeys.factoryProject(factoryProjectId),
    field: 'defaultThinkingLevel',
    write: defaultThinkingLevel => updateFactoryProject(baseUrl, factoryProjectId, { defaultThinkingLevel }),
    savedValue: project => project.defaultThinkingLevel,
  });
}
