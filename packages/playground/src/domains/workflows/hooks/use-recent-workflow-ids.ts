import { useMastraClient } from '@mastra/react';
import { useEffect, useState } from 'react';
import { z } from 'zod/v4';

const recentIdsSchema = z.array(z.string()).max(12);

/** Remount for another workflow; labels and access always come from the current server. */
export function useRecentWorkflowIds(workflowId: string) {
  const client = useMastraClient();
  const storageKey = `mastra:studio:recent-workflows:v1:${JSON.stringify([client.options.baseUrl, client.options.apiPrefix])}`;
  const [ids] = useState(() => {
    try {
      const stored = recentIdsSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
      return [workflowId, ...(stored.success ? stored.data.filter(id => id !== workflowId) : [])].slice(0, 12);
    } catch {
      return [workflowId];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch {
      // Navigation also works without local storage.
    }
  }, [ids, storageKey]);
  return ids;
}
