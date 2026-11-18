import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * Whether the server searches long word-search ranges in chunks (`progressive: true` and `continuation` on span and
 * trace queries and aggregates). `enabled` stays false while capabilities load and when the capability is missing:
 * other servers reject the extra fields.
 */
export const useProgressiveSearchAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.progressiveTokenSearch ?? false),
  };
};
