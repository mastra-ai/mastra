import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * `enabled` stays false while capabilities load. Servers without the
 * capabilities endpoint predate span query, so they fall back to `false`.
 */
export const useSpanQueryAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.spanQuery ?? false),
  };
};
