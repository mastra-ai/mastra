declare global {
  interface Window {
    MASTRA_PLATFORM_ENDPOINT: string;
  }
}

/**
 * Not a hook per se, but will become when we add more features to the platform.
 */
export const useMastraPlatform = () => {
  const mastraPlatformEndpoint = window.MASTRA_PLATFORM_ENDPOINT;
  const isMastraPlatform = Boolean(mastraPlatformEndpoint);

  return { isMastraPlatform, mastraPlatformEndpoint };
};
