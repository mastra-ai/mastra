import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists the agents that currently pin a given connection. Used by the
 * picker to warn before disconnecting a shared account.
 */
export const useConnectionUsage = (
  providerId: string | null | undefined,
  connectionId: string | null | undefined,
  enabled = true,
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integration-connection-usage', providerId, connectionId],
    queryFn: () => client.getToolProvider(providerId!).getConnectionUsage(connectionId!),
    enabled: enabled && !!providerId && !!connectionId,
  });
};
