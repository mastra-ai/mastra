import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * `enabled` stays false while capabilities load. Servers without the
 * capabilities endpoint fall back to `true` (trace query was the default before).
 */
export const useTraceQueryAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.traceQuery ?? true),
  };
};
