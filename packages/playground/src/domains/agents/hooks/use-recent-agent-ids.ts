import { useMastraClient } from '@mastra/react';
import { useEffect, useState } from 'react';
import { z } from 'zod/v4';

const recentAgentIdsSchema = z.array(z.string()).max(12);

/** Remount for a different agent or user; only ids are stored, names come from the server. */
export function useRecentAgentIds(agentId: string, userId?: string) {
  const client = useMastraClient();
  const storageKey = `mastra:studio:recent-agents:v1:${JSON.stringify([
    client.options.baseUrl,
    client.options.apiPrefix,
    userId,
  ])}`;
  const [recentIds] = useState(() => {
    try {
      const stored = recentAgentIdsSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
      const previousIds = stored.success ? stored.data : [];
      return [agentId, ...previousIds.filter(id => id !== agentId)].slice(0, 12);
    } catch {
      return [agentId];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(recentIds));
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }, [recentIds, storageKey]);

  return recentIds;
}
