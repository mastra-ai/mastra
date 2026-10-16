import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * Whether the server can answer `aggregateTraces()`. `enabled` stays false while capabilities load.
 * Unlike trace query, a missing `traceAggregate` (an older server) or a missing capabilities endpoint
 * means aggregation is unavailable.
 */
export const useTraceAggregateAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && data?.capabilities.traceAggregate === true,
  };
};
