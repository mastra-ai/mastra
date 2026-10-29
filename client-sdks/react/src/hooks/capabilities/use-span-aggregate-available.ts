import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * Whether the server can answer `aggregateSpans()`. `enabled` stays false while capabilities load.
 * A missing `spanAggregate` (an older server) or a missing capabilities endpoint means aggregation is unavailable.
 */
export const useSpanAggregateAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && data?.capabilities.spanAggregate === true,
  };
};
