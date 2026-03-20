export const useExperimentalUIEnabled = () => {
  const experimentalUIEnabled =
    typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI === 'true';

  return { experimentalUIEnabled };
};
