import { useObservabilityCapabilities } from './use-observability-capabilities';

/**
 * `enabled` stays false while capabilities load. Servers without the
 * capabilities endpoint fall back to `true` (feedback was shown by default before).
 */
export const useFeedbackAvailable = (): { isLoading: boolean; enabled: boolean } => {
  const { data, isLoading } = useObservabilityCapabilities();

  return {
    isLoading,
    enabled: !isLoading && (data?.capabilities.feedback ?? true),
  };
};
