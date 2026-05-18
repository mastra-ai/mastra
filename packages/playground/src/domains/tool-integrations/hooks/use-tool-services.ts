import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists tool services exposed by a `ToolIntegration` (e.g. `gmail`, `github`).
 */
export const useToolServices = (integrationId: string | null) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integration-services', integrationId],
    queryFn: () => client.getToolIntegration(integrationId!).listToolServices(),
    enabled: !!integrationId,
  });
};
