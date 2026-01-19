import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '../../../store/playground-store';

import type { Task, CreateTaskInput } from '@mastra/core';

// Extended client type to include inbox methods
type InboxClient = {
  addTask?: (params: CreateTaskInput & { requestContext?: unknown }) => Promise<Task>;
  cancelTask?: (taskId: string, requestContext?: unknown) => Promise<{ success: boolean }>;
  releaseTask?: (taskId: string, requestContext?: unknown) => Promise<{ success: boolean }>;
  resumeTask?: (
    taskId: string,
    params: { payload: unknown; requestContext?: unknown },
  ) => Promise<{ success: boolean }>;
};

type MastraClientWithInbox = ReturnType<typeof useMastraClient> & {
  getInbox?: (inboxId: string) => InboxClient;
};

/**
 * Cancel a task.
 */
export function useCancelTask(inboxId: string) {
  const client = useMastraClient() as MastraClientWithInbox;
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async (taskId: string) => {
      await client.getInbox?.(inboxId)?.cancelTask?.(taskId, requestContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', inboxId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-stats', inboxId] });
    },
  });
}

/**
 * Retry a failed task by releasing it back to pending.
 */
export function useRetryTask(inboxId: string) {
  const client = useMastraClient() as MastraClientWithInbox;
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async (taskId: string) => {
      await client.getInbox?.(inboxId)?.releaseTask?.(taskId, requestContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', inboxId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-stats', inboxId] });
    },
  });
}

/**
 * Resume a suspended task with provided input.
 */
export function useResumeTask(inboxId: string) {
  const client = useMastraClient() as MastraClientWithInbox;
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: string; payload: unknown }) => {
      await client.getInbox?.(inboxId)?.resumeTask?.(taskId, { payload, requestContext });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', inboxId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-stats', inboxId] });
    },
  });
}

/**
 * Create a new task in an inbox.
 */
export function useCreateTask(inboxId: string) {
  const client = useMastraClient() as MastraClientWithInbox;
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async (taskInput: CreateTaskInput) => {
      return await client.getInbox?.(inboxId)?.addTask?.({ ...taskInput, requestContext });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', inboxId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-stats', inboxId] });
    },
  });
}
