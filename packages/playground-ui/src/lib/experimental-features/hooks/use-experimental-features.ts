declare global {
  interface Window {
    MASTRA_EXPERIMENTAL_FEATURES?: string;
  }
}

/**
 * Hook to check if experimental features are enabled.
 * Users can enable experimental features by setting the EXPERIMENTAL_FEATURES=true environment variable.
 */
export const useExperimentalFeatures = () => {
  const experimentalFeaturesEnabled = window.MASTRA_EXPERIMENTAL_FEATURES === 'true';

  return { experimentalFeaturesEnabled };
};
