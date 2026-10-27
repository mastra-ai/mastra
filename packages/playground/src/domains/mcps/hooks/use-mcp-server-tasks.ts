import type { McpServerTask, McpServerTaskInputResponses, McpServerTaskListResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const TERMINAL: ReadonlySet<McpServerTask['status']> = new Set(['completed', 'failed', 'cancelled']);

export const isTerminalTask = (task: McpServerTask) => TERMINAL.has(task.status);

/** Refetch every 2s while a listed task can still change. */
export const TASKS_REFETCH_MS = 2_000;

const tasksKey = (serverId: string) => ['mcp-server-tasks', serverId];

/**
 * Which tools a server runs as MCP tasks, and its recent tasks; only fetched for servers that
 * report `tasks_capability`. Polls while any task is still working or waiting for input.
 */
export function useMcpServerTasks(serverId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: tasksKey(serverId),
    queryFn: () => client.getMcpServerTasks(serverId),
    enabled,
    refetchInterval: query => {
      const data: McpServerTaskListResponse | undefined = query.state.data;
      return data?.tasks.some(task => !isTerminalTask(task)) ? TASKS_REFETCH_MS : false;
    },
  });
}

/** Cancels a task by key, then refreshes the list. */
export function useCancelMcpServerTask(serverId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskKey: string) => client.cancelMcpServerTask(serverId, taskKey),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(serverId) }),
  });
}

/** Answers a task's open input requests by key, then refreshes the list. */
export function useAnswerMcpServerTask(serverId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskKey, inputResponses }: { taskKey: string; inputResponses: McpServerTaskInputResponses }) =>
      client.answerMcpServerTaskInput(serverId, taskKey, inputResponses),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(serverId) }),
  });
}
