import type {
  McpServerTask,
  McpServerTaskInputResponses,
  McpServerTaskListResponse,
  McpServerTaskSurface,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const TERMINAL: ReadonlySet<McpServerTask['status']> = new Set(['completed', 'failed', 'cancelled']);

export const TASK_STATUS_LABELS: Record<McpServerTask['status'], string> = {
  working: 'working',
  input_required: 'input required',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

export const isTerminalTask = (task: McpServerTask) => TERMINAL.has(task.status);

/** Refetch every 2s while a listed task can still change. */
export const TASKS_REFETCH_MS = 2_000;

/** Narrows the task list; each filter is applied by the server. */
export interface McpTaskFilters {
  status?: McpServerTask['status'];
  surface?: string;
  /** A client key (`principalKey`). */
  client?: string;
}

const tasksKey = (serverId: string) => ['mcp-server-tasks', serverId];

const stillRunning = (tasks: McpServerTask[] | undefined) => Boolean(tasks?.some(task => !isTerminalTask(task)));

/**
 * The server's tasks, newest first, matching `filters`; `fetchNextPage` loads older ones.
 * Polls while any loaded task is still working or waiting for input.
 */
export function useMcpServerTasks(serverId: string, filters: McpTaskFilters = {}) {
  const client = useMastraClient();
  return useInfiniteQuery({
    queryKey: [...tasksKey(serverId), 'list', filters],
    queryFn: ({ pageParam }) => client.getMcpServerTasks(serverId, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: McpServerTaskListResponse) => page.nextCursor,
    refetchInterval: query =>
      query.state.data?.pages.some(page => stillRunning(page.tasks)) ? TASKS_REFETCH_MS : false,
  });
}

/** Which tools the server runs as tasks; only fetched for servers that report `tasks_capability`. */
export function useMcpServerTaskSurfaces(serverId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: [...tasksKey(serverId), 'surfaces'],
    queryFn: () => client.getMcpServerTasks(serverId, { limit: 1 }),
    select: (data): McpServerTaskSurface[] => data.surfaces,
    enabled,
  });
}

/** One task by key, whether or not a loaded page of the list holds it. Polls until it ends. */
export function useMcpServerTask(serverId: string, taskKey: string | undefined) {
  const client = useMastraClient();
  return useQuery({
    queryKey: [...tasksKey(serverId), 'task', taskKey],
    queryFn: async () => (await client.getMcpServerTasks(serverId, { key: taskKey, limit: 1 })).tasks[0] ?? null,
    enabled: taskKey !== undefined,
    refetchInterval: query => (query.state.data && !isTerminalTask(query.state.data) ? TASKS_REFETCH_MS : false),
  });
}

/** Finds a task by MCP task id; the server hashes the id and answers with the task's key. */
export function useFindMcpServerTask(serverId: string) {
  const client = useMastraClient();
  return useMutation({
    mutationFn: (taskId: string) => client.findMcpServerTask(serverId, taskId),
  });
}

/** Cancels a task by key, then refreshes the list and the task. */
export function useCancelMcpServerTask(serverId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskKey: string) => client.cancelMcpServerTask(serverId, taskKey),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(serverId) }),
  });
}

/** Answers a task's open input requests by key, then refreshes the list and the task. */
export function useAnswerMcpServerTask(serverId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskKey, inputResponses }: { taskKey: string; inputResponses: McpServerTaskInputResponses }) =>
      client.answerMcpServerTaskInput(serverId, taskKey, inputResponses),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(serverId) }),
  });
}
