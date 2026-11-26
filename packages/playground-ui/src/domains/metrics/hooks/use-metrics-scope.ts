import { useMetrics } from './use-metrics';
import type { MetricsScope } from './use-metrics';

/** Projects on the page: set only where a page spans several projects. */
export function useMetricsScope(): MetricsScope {
  return useMetrics().scope;
}
