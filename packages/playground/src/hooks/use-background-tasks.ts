import type { ReadableStreamDefaultReader } from 'node:stream/web';
import type { StreamBackgroundTasksParams } from '@mastra/client-js';
import type { BackgroundTaskStatus } from '@mastra/core/background-tasks';
import type { AgentChunkType } from '@mastra/core/stream';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface BackgroundTaskEvent {
  taskId: string;
  toolName: string;
  toolCallId: string;
  agentId: string;
  runId: string;
  result?: unknown;
  error?: { message: string; stack?: string };
  status: BackgroundTaskStatus;
  args: Record<string, unknown>;
}

export interface UseBackgroundTaskStreamOptions extends StreamBackgroundTasksParams {
  /** Whether the stream is active. Default: true */
  enabled?: boolean;
}

export interface UseBackgroundTaskStreamReturn {
  /** Map of taskId → latest event data */
  tasks: Record<string, BackgroundTaskEvent>;
  /** Whether the stream is currently connected */
  isConnected: boolean;
  /** Any connection error */
  error: Error | null;
  /** Manually disconnect the stream */
  disconnect: () => void;
  /** Manually reconnect the stream */
  reconnect: () => void;
  /** List of running tasks */
  runningTasks: BackgroundTaskEvent[];
  /** List of completed tasks */
  completedTasks: BackgroundTaskEvent[];
  /** List of failed tasks */
  failedTasks: BackgroundTaskEvent[];
  /** Clear completed and failed tasks */
  clearCompletedAndFailedTasks: () => void;
}

/**
 * Streams background task events via SSE and accumulates them in a map keyed by taskId.
 *
 * Each incoming event (task.completed / task.failed) is stored in state so the UI
 * can react to completions — e.g., show a toast, update a badge, or display results.
 *
 * @example
 * ```tsx
 * const { tasks, isConnected, completedTasks } = useBackgroundTaskStream({ agentId: 'crypto-agent' });
 *
 * // Show a badge with completed count
 * const completedCount = completedTasks.length;
 * ```
 */

type EventType = Extract<
  AgentChunkType,
  {
    type:
      | 'background-task-running'
      | 'background-task-completed'
      | 'background-task-failed'
      | 'background-task-cancelled'
      | 'background-task-output';
  }
>;

const EVENT_STATUS_MAP: Record<EventType['type'], BackgroundTaskStatus> = {
  'background-task-running': 'running',
  'background-task-output': 'running',
  'background-task-completed': 'completed',
  'background-task-failed': 'failed',
  'background-task-cancelled': 'cancelled',
};

export function useBackgroundTaskStream(options: UseBackgroundTaskStreamOptions = {}): UseBackgroundTaskStreamReturn {
  const { enabled = true, agentId, runId, threadId, resourceId, taskId } = options;
  const client = useMastraClient();

  const [tasks, setTasks] = useState<Record<string, BackgroundTaskEvent>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<any> | null>(null);
  const connectSeqRef = useRef(0);

  const runningTasks = useMemo(() => {
    return Object.values(tasks).filter(task => task.status === 'running');
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return Object.values(tasks).filter(task => task.status === 'completed');
  }, [tasks]);

  const failedTasks = useMemo(() => {
    return Object.values(tasks).filter(task => task.status === 'failed');
  }, [tasks]);

  const cleanup = useCallback(() => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    const seq = ++connectSeqRef.current;
    cleanup();
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stream = await client.streamBackgroundTasks({ agentId, runId, threadId, resourceId, taskId });

      if (!stream) {
        setError(new Error('Stream connection failed'));
        return;
      }

      if (seq === connectSeqRef.current) {
        setIsConnected(true);
      }

      // Get a reader from the ReadableStream and store it in ref
      const reader = stream.getReader();
      readerRef.current = reader;

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        const event = value as EventType;
        if (event.type !== 'background-task-output') {
          setTasks(prev => ({
            ...prev,
            [event.payload.taskId]: {
              ...prev[event.payload.taskId],
              ...event.payload,
              status: EVENT_STATUS_MAP[event.type],
            },
          }));
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        if (seq === connectSeqRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    } finally {
      if (seq === connectSeqRef.current) {
        setIsConnected(false);
      }
    }
  }, [client, agentId, runId, threadId, resourceId, taskId, cleanup]);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    void connect();
    return cleanup;
  }, [enabled, connect, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const reconnect = useCallback(() => {
    void connect();
  }, [connect]);

  const clearCompletedAndFailedTasks = () => {
    setTasks(prev => {
      const newTasks = { ...prev };
      Object.values(newTasks).forEach(task => {
        if (
          task.status === 'completed' ||
          task.status === 'failed' ||
          task.status === 'cancelled' ||
          task.status === 'timed_out'
        ) {
          delete newTasks[task.taskId];
        }
      });
      return newTasks;
    });
  };

  return {
    tasks,
    isConnected,
    error,
    disconnect,
    reconnect,
    runningTasks,
    completedTasks,
    failedTasks,
    clearCompletedAndFailedTasks,
  };
}

export const useGetBackgroundTaskById = (backgroundTaskId: string, enabled: boolean = true) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['background-task', backgroundTaskId],
    queryFn: () => client.getBackgroundTask(backgroundTaskId),
    enabled,
  });
};
