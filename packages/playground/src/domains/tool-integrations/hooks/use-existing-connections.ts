import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists existing provider connections for the caller, scoped to a tool
 * service. Powers the "use existing connection" path in the picker so
 * authors can pin previously-authorized accounts without re-running OAuth.
 *
 * The connection owner is resolved server-side from the request's auth
 * context — clients cannot pass a userId.
 */
export const useExistingConnections = (
  integrationId: string | null | undefined,
  toolService: string | null | undefined,
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integration-connections', integrationId, toolService],
    queryFn: () => client.getToolIntegration(integrationId!).listConnections({ toolService: toolService! }),
    enabled: !!integrationId && !!toolService,
  });
};
