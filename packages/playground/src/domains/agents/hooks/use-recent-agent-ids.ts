import { useMastraClient } from '@mastra/react';
import { useEffect, useState } from 'react';
import { z } from 'zod/v4';

const recentAgentIdsSchema = z.array(z.string()).max(12);

function useRecentAgentsStorageKey(userId?: string) {
  const client = useMastraClient();
  return `mastra:studio:recent-agents:v1:${JSON.stringify([client.options.baseUrl, client.options.apiPrefix, userId])}`;
}

function readRecentAgentIds(storageKey: string) {
  try {
    const stored = recentAgentIdsSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
    return stored.success ? stored.data : [];
  } catch {
    return [];
  }
}

export function useStoredRecentAgentIds(userId?: string) {
  return readRecentAgentIds(useRecentAgentsStorageKey(userId));
}

/** Remount for a different agent or user; only ids are stored, names come from the server. */
export function useRecentAgentIds(agentId: string, userId?: string) {
  const storageKey = useRecentAgentsStorageKey(userId);
  const [recentIds] = useState(() =>
    [agentId, ...readRecentAgentIds(storageKey).filter(id => id !== agentId)].slice(0, 12),
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(recentIds));
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }, [recentIds, storageKey]);

  return recentIds;
}
