import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '../../../store/playground-store';
import type { Task, ListFilter, InboxStats } from '@mastra/core';

// Extended client type to include inbox methods
type InboxClient = {
  listTasks?: (params?: ListFilter & { requestContext?: unknown }) => Promise<{ tasks: Task[]; pagination?: unknown }>;
  getTask?: (taskId: string, requestContext?: unknown) => Promise<Task | null>;
  getStats?: (requestContext?: unknown) => Promise<InboxStats>;
};

type MastraClientWithInbox = ReturnType<typeof useMastraClient> & {
  getInbox?: (inboxId: string) => InboxClient;
};

export interface TaskFilter extends ListFilter {
  search?: string;
}

/**
 * Fetch tasks from a specific inbox with optional filtering.
 */
export function useTasks(inboxId: string, filter?: TaskFilter) {
  const client = useMastraClient() as MastraClientWithInbox;
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['tasks', inboxId, filter, requestContext],
    queryFn: async () => {
      const response = await client.getInbox?.(inboxId)?.listTasks?.({ ...filter, requestContext });
      return response?.tasks ?? [];
    },
    enabled: !!client.getInbox && !!inboxId,
  });
}

/**
 * Fetch a single task by ID.
 */
export function useTask(inboxId: string, taskId: string) {
  const client = useMastraClient() as MastraClientWithInbox;
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['task', inboxId, taskId, requestContext],
    queryFn: async () => {
      const response = await client.getInbox?.(inboxId)?.getTask?.(taskId, requestContext);
      return response as Task | null;
    },
    enabled: !!client.getInbox && !!inboxId && !!taskId,
  });
}

/**
 * Fetch inbox statistics.
 */
export function useInboxStats(inboxId: string) {
  const client = useMastraClient() as MastraClientWithInbox;
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['inbox-stats', inboxId, requestContext],
    queryFn: async () => {
      const response = await client.getInbox?.(inboxId)?.getStats?.(requestContext);
      return (
        response ?? {
          pending: 0,
          claimed: 0,
          inProgress: 0,
          waitingForInput: 0,
          completed: 0,
          failed: 0,
        }
      );
    },
    enabled: !!client.getInbox && !!inboxId,
  });
}
