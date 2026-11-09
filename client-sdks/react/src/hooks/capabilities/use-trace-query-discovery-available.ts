import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * Whether the store supports trace query field/value discovery. Callers combine it with
 * `useTraceQueryAvailable` when they also need the trace query API. `enabled` stays false
 * while capabilities load; servers without the capabilities endpoint fall back to `true`.
 */
export const useTraceQueryDiscoveryAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.traceQueryDiscovery ?? true),
  };
};
