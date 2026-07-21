import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryMetrics } from '../../web/ui/domains/factory/services/metrics';

/** Aggregated flow metrics for the project's Factory board. */
export function useFactoryMetrics(factoryProjectId: string | undefined, days: number) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryMetrics(factoryProjectId, days),
    queryFn: () => fetchFactoryMetrics(baseUrl, factoryProjectId!, days),
    enabled: Boolean(factoryProjectId),
    staleTime: 30_000,
  });
}
