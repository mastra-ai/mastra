import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { fetchFactoryMetrics } from '../services/metrics';

/** Aggregated flow metrics for the project's Factory board. */
export function useFactoryMetrics(githubProjectId: string | undefined, days: number) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryMetrics(githubProjectId, days),
    queryFn: () => fetchFactoryMetrics(baseUrl, githubProjectId!, days),
    enabled: Boolean(githubProjectId),
    staleTime: 30_000,
  });
}
