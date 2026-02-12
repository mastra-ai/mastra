import { coreFeatures } from '@mastra/core/features';

/**
 * Hook to check if experimental features are enabled.
 * Checks whether @mastra/core advertises the 'datasets' feature flag.
 */
export const useExperimentalFeatures = () => {
  const experimentalFeaturesEnabled = coreFeatures.has('datasets');

  return { experimentalFeaturesEnabled };
};
