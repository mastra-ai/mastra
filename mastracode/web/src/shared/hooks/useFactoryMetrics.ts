import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryMetrics } from '../../web/ui/domains/factory/services/metrics';
import type { FactoryMetricsRange } from '../../web/ui/domains/factory/services/metrics';

/** Aggregated flow metrics for the project's Factory board over a window. */
export function useFactoryMetrics(factoryProjectId: string | undefined, range: FactoryMetricsRange) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryMetrics(factoryProjectId, range.from, range.to),
    queryFn: () => fetchFactoryMetrics(baseUrl, factoryProjectId!, range),
    enabled: Boolean(factoryProjectId),
    staleTime: 30_000,
  });
}
