import { useMetricsQueryFilters } from '@mastra/react/hooks';
import type { MetricsQueryFilters } from '@mastra/react/hooks';

import { useMetrics } from './use-metrics';

/** Binds the SDK metrics filter helper to the dashboard's MetricsProvider. */
export function useMetricsFilters(): MetricsQueryFilters {
  const { datePreset, customRange, dimensionalFilter, dimensionalFilterKey } = useMetrics();
  return useMetricsQueryFilters({ datePreset, customRange, dimensionalFilter, dimensionalFilterKey });
}
