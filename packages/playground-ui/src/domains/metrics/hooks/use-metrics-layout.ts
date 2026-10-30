import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';

/**
 * Which Metrics page to render. `unified` needs both trace and span aggregates; anything less (an
 * older server, a store without aggregates, or a failed capabilities request) gets `legacy`, the page
 * as it was before those routes existed. Studio can be upgraded without its storage, so the page
 * never mixes the two.
 */
export type MetricsLayout = 'loading' | 'unified' | 'legacy';

export function useMetricsLayout(): MetricsLayout {
  const { data, isLoading } = useObservabilityCapabilities();
  if (isLoading) return 'loading';
  const capabilities = data?.capabilities;
  return capabilities?.traceAggregate === true && capabilities.spanAggregate === true ? 'unified' : 'legacy';
}
