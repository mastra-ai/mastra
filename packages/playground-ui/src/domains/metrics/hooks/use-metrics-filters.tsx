import { useMetricsQueryFilters } from '@mastra/react/hooks/metrics';
import type { MetricsQueryFilters } from '@mastra/react/hooks/metrics';

import { useMetrics } from './use-metrics';

/** The dashboard's window and filters. Inside `MetricsProvider`, every card shares its frozen window. */
export function useMetricsFilters(): MetricsQueryFilters {
  const { datePreset, customRange, dimensionalFilter, dimensionalFilterKey, queryFilters } = useMetrics();
  const own = useMetricsQueryFilters({ datePreset, customRange, dimensionalFilter, dimensionalFilterKey });
  return queryFilters ?? own;
}
