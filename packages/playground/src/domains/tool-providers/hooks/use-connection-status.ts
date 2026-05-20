import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface ConnectionStatusItem {
  connectionId: string;
  toolkit: string;
}

/**
 * Batched connection-status query for a `ToolProvider` provider.
 *
 * Reused by Phase 9's health pill. Disabled when `items` is empty.
 */
export const useConnectionStatus = (providerId: string | null, items: ConnectionStatusItem[]) => {
  const client = useMastraClient();
  // Stable cache key derived from sorted (connectionId, toolkit) pairs.
  const key = items
    .map(i => `${i.toolkit}:${i.connectionId}`)
    .sort()
    .join('|');

  return useQuery({
    queryKey: ['tool-integration-connection-status', providerId, key],
    queryFn: () => client.getToolProvider(providerId!).getConnectionStatus({ items }),
    enabled: !!providerId && items.length > 0,
  });
};
