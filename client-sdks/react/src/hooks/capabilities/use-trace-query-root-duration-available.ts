import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * Whether the store supports trace-level `durationMs` (root duration) predicates in trace queries.
 * `enabled` stays false while capabilities load, and also when the capability is missing: older
 * servers reject `durationMs` predicates, so this does not fall back to `true`.
 */
export const useTraceQueryRootDurationAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.traceQueryRootDuration ?? false),
  };
};
