import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '../../../store/playground-store';

// Extended client type to include inbox methods (not yet in MastraClient)
type MastraClientWithInbox = ReturnType<typeof useMastraClient> & {
  listInboxes?: (ctx?: unknown) => Promise<{ inboxes: Array<{ id: string; name?: string }> }>;
  getInbox?: (inboxId: string) => {
    listTasks?: (filter?: unknown, ctx?: unknown) => Promise<unknown[]>;
    getTask?: (taskId: string, ctx?: unknown) => Promise<unknown>;
    getStats?: (ctx?: unknown) => Promise<unknown>;
    cancelTask?: (taskId: string, ctx?: unknown) => Promise<void>;
    releaseTask?: (taskId: string, ctx?: unknown) => Promise<void>;
    resumeTask?: (taskId: string, input: unknown, ctx?: unknown) => Promise<void>;
  };
};

/**
 * Fetch all registered inboxes.
 */
export function useInboxes() {
  const client = useMastraClient() as MastraClientWithInbox;
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['inboxes', requestContext],
    queryFn: async () => {
      const response = await client.listInboxes?.(requestContext);
      return response?.inboxes ?? [];
    },
    enabled: !!client.listInboxes,
  });
}
