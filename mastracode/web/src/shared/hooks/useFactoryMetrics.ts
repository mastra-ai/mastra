import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryMetrics } from '../../web/ui/domains/factory/services/metrics';

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
