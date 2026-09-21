import { isBackgroundTaskResumePublishedError } from './manager';
import type { BackgroundTaskManager } from './manager';
import type {
  BackgroundTaskResumeOptions,
  BackgroundTaskHandle,
  CheckIfRunningPayload,
  CheckIfSuspendedPayload,
  CreateBackgroundTaskOptions,
} from './types';

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

  // A handle carrying `requiresToolPermissionHook` that attaches to a row it
  // did not enqueue (the resume/restart legs, or a row written before the
  // marker existed) must backfill the persisted marker *before* publishing a
  // claimable event — otherwise a foreign worker or cold recovery resolves a
  // static executor and executes without revalidation.
  const ensureHookRequirementPersisted = async () => {
    if (!taskId || payload.requiresToolPermissionHook !== true) return;
    await manager.markTaskRequiresToolPermissionHook(taskId);
  };

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

    async checkIfSuspended(args: CheckIfSuspendedPayload) {
      const result = await manager.listTasks({
        toolCallId: args.toolCallId,
        runId: args.runId,
        agentId: args.agentId,
        threadId: args.threadId,
        resourceId: args.resourceId,
        toolName: args.toolName,
        status: 'suspended',
      });
      if (result.total > 0) {
        const task = result.tasks[0];
        if (task) {
          taskId = task.id;
          await ensureHookRequirementPersisted();
          return true;
        }
      }

      return false;
    },

    async checkIfRunning(args: CheckIfRunningPayload) {
      const result = await manager.listTasks({
        toolCallId: args.toolCallId,
        runId: args.runId,
        agentId: args.agentId,
        threadId: args.threadId,
        resourceId: args.resourceId,
        toolName: args.toolName,
        status: 'running',
      });
      if (result.total > 0) {
        const task = result.tasks[0];
        if (task) {
          taskId = task.id;
          await ensureHookRequirementPersisted();
          return true;
        }
      }

      return false;
    },

    async resume(resumeData?: unknown, resumeOptions?: BackgroundTaskResumeOptions) {
      if (!taskId) throw new Error('Task has not been dispatched yet');
      await ensureHookRequirementPersisted();
      manager.registerTaskContext(taskId, context);
      try {
        return resumeOptions
          ? await manager.resume(taskId, resumeData, resumeOptions)
          : await manager.resume(taskId, resumeData);
      } catch (error) {
        if (!isBackgroundTaskResumePublishedError(error)) {
          manager.deregisterTaskContext(taskId);
        }
        throw error;
      }
    },

    async restart() {
      if (!taskId) throw new Error('Task has not been dispatched yet');
      await ensureHookRequirementPersisted();
      return manager.restart(taskId, context);
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
