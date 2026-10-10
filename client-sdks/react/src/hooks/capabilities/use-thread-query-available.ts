import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * `enabled` stays false while capabilities load. Unlike trace query, servers without the
 * capabilities endpoint predate thread queries, so a missing flag means unsupported.
 */
export const useThreadQueryAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.threadQuery ?? false),
  };
};
