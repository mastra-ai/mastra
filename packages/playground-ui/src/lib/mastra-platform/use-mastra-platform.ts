declare global {
  interface Window {
    MASTRA_CLOUD_API_ENDPOINT?: string;
    MASTRA_ORGANIZATION_ID?: string;
    MASTRA_PLATFORM_PROJECT_ID?: string;
    MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
  }
}

/**
 * Reads the Mastra platform window globals. Mirrors the contract used by the
 * playground shell so platform-only features (e.g. entity learning / signals)
 * can fetch directly from the platform endpoint without `@mastra/client-js`.
 *
 * Not a hook per se, but kept hook-shaped so it can grow real reactive state.
 */
export const useMastraPlatform = () => {
  const mastraPlatformEndpoint = typeof window === 'undefined' ? undefined : window.MASTRA_CLOUD_API_ENDPOINT;
  const mastraOrganizationId = typeof window === 'undefined' ? undefined : window.MASTRA_ORGANIZATION_ID || undefined;
  const mastraPlatformProjectId =
    typeof window === 'undefined' ? undefined : window.MASTRA_PLATFORM_PROJECT_ID || undefined;
  const mastraPlatformObservabilityEndpoint =
    typeof window === 'undefined' ? undefined : window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT || undefined;
  const isMastraPlatform = Boolean(mastraPlatformEndpoint);

  return {
    isMastraPlatform,
    mastraPlatformEndpoint,
    mastraPlatformApiEndpoint: mastraPlatformEndpoint,
    mastraPlatformObservabilityEndpoint,
    mastraOrganizationId,
    mastraPlatformProjectId,
  };
};
