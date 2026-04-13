import type { ReadableStreamDefaultReader } from 'node:stream/web';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMastraClient } from '@mastra/react';
import type { StreamBackgroundTasksParams } from '@mastra/client-js';
import { BackgroundTaskStatus, BackgroundTaskOutputChunk } from '@mastra/core/background-tasks';

export interface BackgroundTaskEvent {
  type: 'task.completed' | 'task.failed' | 'task.running' | 'task.cancelled' | 'task.output';
  taskId: string;
  toolName: string;
  toolCallId: string;
  agentId: string;
  runId: string;
  result?: unknown;
  error?: { message: string; stack?: string };
  status: BackgroundTaskStatus;
  args: Record<string, unknown>;
  chunk?: BackgroundTaskOutputChunk;
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
 * const { tasks, isConnected } = useBackgroundTaskStream({ agentId: 'crypto-agent' });
 *
 * // Show a badge with completed count
 * const completedCount = Object.values(tasks).filter(t => t.type === 'task.completed').length;
 * ```
 */
export function useBackgroundTaskStream(options: UseBackgroundTaskStreamOptions = {}): UseBackgroundTaskStreamReturn {
  const { enabled = true, agentId, runId, threadId, resourceId } = options;
  const client = useMastraClient();

  const [tasks, setTasks] = useState<Record<string, BackgroundTaskEvent>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<any> | null>(null);

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
    cleanup();
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stream = await client.streamBackgroundTasks({ agentId, runId, threadId, resourceId });

      if (!stream) {
        setError(new Error('Stream connection failed'));
        return;
      }

      setIsConnected(true);

      // Get a reader from the ReadableStream and store it in ref
      const reader = stream.getReader();
      readerRef.current = reader;

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        const event = value as BackgroundTaskEvent;
        console.log({ event });
        setTasks(prev => ({ ...prev, [event.taskId]: { ...prev.taskId, ...event } }));
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setIsConnected(false);
    }
  }, [client, agentId, runId, threadId, resourceId, cleanup]);

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
        if (task.status === 'completed' || task.status === 'failed') {
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
