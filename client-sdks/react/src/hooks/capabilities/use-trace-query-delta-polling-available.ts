import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * Whether the store supports delta polling (`queryTraces({ mode: 'delta' })`).
 * `enabled` stays false while capabilities load, and also when the capability is missing: older
 * servers answer delta requests with 501, so this does not fall back to `true`.
 */
export const useTraceQueryDeltaPollingAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.deltaPolling ?? false),
  };
};
