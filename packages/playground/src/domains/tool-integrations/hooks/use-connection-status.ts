import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface ConnectionStatusItem {
  connectionId: string;
  toolService: string;
}

/**
 * Batched connection-status query for a `ToolIntegration` provider.
 *
 * Reused by Phase 9's health pill. Disabled when `items` is empty.
 */
export const useConnectionStatus = (integrationId: string | null, items: ConnectionStatusItem[]) => {
  const client = useMastraClient();
  // Stable cache key derived from sorted (connectionId, toolService) pairs.
  const key = items
    .map(i => `${i.toolService}:${i.connectionId}`)
    .sort()
    .join('|');

  return useQuery({
    queryKey: ['tool-integration-connection-status', integrationId, key],
    queryFn: () => client.getToolIntegration(integrationId!).getConnectionStatus({ items }),
    enabled: !!integrationId && items.length > 0,
  });
};
