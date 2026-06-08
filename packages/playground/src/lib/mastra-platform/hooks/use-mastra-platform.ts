declare global {
  interface Window {
    MASTRA_CLOUD_API_ENDPOINT: string;
    MASTRA_PLATFORM_PROJECT_ID?: string;
    MASTRA_PLATFORM_USER_NAME?: string;
  }
}

/**
 * Not a hook per se, but will become when we add more features to the platform.
 */
const sanitize = (value?: string) => {
  if (!value || value.startsWith('%%')) return undefined;
  return value;
};

export const useMastraPlatform = () => {
  const mastraPlatformEndpoint = sanitize(window.MASTRA_CLOUD_API_ENDPOINT);
  const mastraPlatformProjectId = sanitize(window.MASTRA_PLATFORM_PROJECT_ID);
  const mastraPlatformUserName = sanitize(window.MASTRA_PLATFORM_USER_NAME);
  const isMastraPlatform = Boolean(mastraPlatformEndpoint);

  return {
    isMastraPlatform,
    mastraPlatformEndpoint,
    mastraPlatformApiEndpoint: mastraPlatformEndpoint,
    mastraPlatformProjectId,
    mastraPlatformUserName,
  };
};
