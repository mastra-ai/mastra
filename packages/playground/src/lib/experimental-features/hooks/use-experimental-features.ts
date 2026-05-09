import { coreFeatures } from '@mastra/core/features';

/**
 * Hook to check if experimental features are enabled.
 * Requires both:
 * 1. @mastra/core advertises the 'datasets' feature flag
 * 2. EXPERIMENTAL_FEATURES env var is set to 'true' (injected via window.MASTRA_EXPERIMENTAL_FEATURES)
 */
export const useExperimentalFeatures = () => {
  const envFlag =
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_FEATURES === 'true';
  const experimentalFeaturesEnabled = coreFeatures.has('datasets') && envFlag;

  return { experimentalFeaturesEnabled };
};
