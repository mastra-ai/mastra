declare global {
  interface Window {
    MASTRA_CLOUD_API_ENDPOINT: string;
    MASTRA_PLATFORM_PROJECT_ID?: string;
    MASTRA_ORGANIZATION_ID?: string;
    MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
  }
}

/**
 * Not a hook per se, but will become when we add more features to the platform.
 */
export const useMastraPlatform = () => {
  const mastraPlatformEndpoint = window.MASTRA_CLOUD_API_ENDPOINT;
  const mastraPlatformProjectId = window.MASTRA_PLATFORM_PROJECT_ID;
  const mastraOrganizationId = window.MASTRA_ORGANIZATION_ID;
  const platformObservabilityEndpoint = window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
  const isMastraPlatform = Boolean(mastraPlatformEndpoint);

  return {
    isMastraPlatform,
    mastraPlatformEndpoint,
    mastraPlatformApiEndpoint: mastraPlatformEndpoint,
    mastraPlatformProjectId,
    mastraOrganizationId,
    platformObservabilityEndpoint,
  };
};
