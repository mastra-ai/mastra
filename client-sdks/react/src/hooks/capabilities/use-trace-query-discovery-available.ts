import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * Field/value discovery needs both trace query and discovery support. `enabled` stays
 * false while capabilities load; servers without the capabilities endpoint fall back to `true`.
 */
export const useTraceQueryDiscoveryAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();
  const capabilities = data?.capabilities;

  return {
    isLoading,
    enabled: !isLoading && (capabilities?.traceQuery ?? true) && (capabilities?.traceQueryDiscovery ?? true),
  };
};
