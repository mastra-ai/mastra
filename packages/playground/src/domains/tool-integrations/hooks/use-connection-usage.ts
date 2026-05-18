import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists the agents that currently pin a given connection. Used by the
 * picker to warn before disconnecting a shared account.
 */
export const useConnectionUsage = (
  integrationId: string | null | undefined,
  connectionId: string | null | undefined,
  enabled = true,
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integration-connection-usage', integrationId, connectionId],
    queryFn: () => client.getToolIntegration(integrationId!).getConnectionUsage(connectionId!),
    enabled: enabled && !!integrationId && !!connectionId,
  });
};
