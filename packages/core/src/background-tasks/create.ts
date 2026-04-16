import type { BackgroundTaskManager } from './manager';
import type { BackgroundTaskHandle, CreateBackgroundTaskOptions } from './types';

/**
 * Creates a self-contained background task handle.
 *
 * Bundles the task payload with per-stream hooks (executor, onChunk, onResult)
 * so each dispatch is fully isolated — no shared mutable state on the manager.
 *
 * @example
 * ```ts
 * const bgTask = createBackgroundTask(manager, {
 *   toolName: 'research',
 *   toolCallId: 'call-1',
 *   args: { query: 'solana' },
 *   agentId: 'agent-1',
 *   runId: 'run-1',
 *   context: {
 *     executor: { execute: (args, opts) => tool.execute(args, opts) },
 *     onChunk: (chunk) => controller.enqueue(chunk),
 *     onResult: (params) => messageList.addToolResult(params),
 *   },
 * });
 *
 * const { task, fallbackToSync } = await bgTask.dispatch();
 * const completed = await bgTask.waitForCompletion();
 * await bgTask.cancel();
 * ```
 */
export function createBackgroundTask(
  manager: BackgroundTaskManager,
  options: CreateBackgroundTaskOptions,
): BackgroundTaskHandle {
  const { context, ...payload } = options;
  let taskId: string | undefined;

  return {
    get task() {
      if (!taskId) throw new Error('Task has not been dispatched yet');
      // Synchronous access to task ID — full task data requires async getTask()
      return { id: taskId } as any;
    },

    async dispatch() {
      const result = await manager.enqueue(payload, context);
      taskId = result.task.id;
      return result;
    },

    async cancel() {
      if (!taskId) throw new Error('Task has not been dispatched yet');
      return manager.cancel(taskId);
    },

    async waitForCompletion(waitOptions) {
      if (!taskId) throw new Error('Task has not been dispatched yet');
      return manager.waitForNextTask([taskId], waitOptions);
    },
  };
}
