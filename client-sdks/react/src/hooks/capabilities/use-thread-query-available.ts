import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * `enabled` stays false while capabilities load. Servers without the
 * capabilities endpoint predate thread rows, so they fall back to `false`.
 */
export const useThreadQueryAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.threadQueryRows ?? false),
  };
};
