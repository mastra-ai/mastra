import { z } from 'zod';
import type { SuspendOptions } from '../workflows';
import { createStep, createWorkflow } from '../workflows/evented';
import type { BackgroundTaskManager } from './manager';
import type { BackgroundTaskStatus } from './types';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

export { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

const inputSchema = z.object({ taskId: z.string() });
const outputSchema = z.object({ result: z.unknown() });

const WORKFLOW_STATUS_TO_PERSIST = ['suspended', 'pending', 'paused', 'waiting'];

/**
 * Builds the per-task evented workflow that owns executor + retries.
 *
 * Single step (`execute`) with an in-body for-loop for retries. We had a go
 * at decomposing into `[execute, handle-result]` steps in a `dountil` loop,
 * but the evented runtime's nested-workflow-as-loop-body path doesn't
 * re-evaluate the predicate cleanly when the body completes (the only loop
 * predicate evaluation lives in `processWorkflowStepRun`, and that branch
 * returns early when the body is itself a workflow). Until that gap is
 * closed upstream, the in-step loop is the cleanest route.
 *
 * The body still has a clear two-phase structure — `runOneAttempt` does the
 * executor invocation + classifies the outcome; the surrounding code
 * persists status + decides retry. They're just not separate steps yet.
 *
 * Step body closes over `manager` directly (private fields are exposed via
 * `@internal` — the bg-tasks layer is the only consumer).
 */
export function buildBackgroundTaskWorkflow(manager: BackgroundTaskManager) {
  const executeStep = createStep({
    id: 'execute',
    inputSchema,
    outputSchema,
    execute: async ({ inputData, abortSignal: workflowAbortSignal, suspend, resumeData }) => {
      const { taskId } = inputData;
      const storage = await manager.getStorage();
      const task = await storage.getTask(taskId);
      if (!task || task.status === 'cancelled') {
        manager.deregisterTaskContext(taskId);
        return { result: undefined };
      }

      const ctx = manager.taskContexts.get(taskId);
      if (!ctx?.executor) {
        const errorInfo = { message: 'No executor registered for this task' };
        await storage.updateTask(taskId, { status: 'failed', error: errorInfo, completedAt: new Date() });
        const failedTask = await storage.getTask(taskId);
        if (failedTask) {
          await manager.runLocalCompletionHooks(failedTask, 'failed', { error: errorInfo });
          await manager.publishLifecycleEvent('task.failed', failedTask);
        }
        manager.deregisterTaskContext(taskId);
        throw new Error('No executor registered');
      }

      // Throttled progress publisher.
      const progressThrottleMs = manager.config.progressThrottleMs;
      const shouldThrottleProgress =
        typeof progressThrottleMs === 'number' && Number.isFinite(progressThrottleMs) && progressThrottleMs > 0;
      let lastProgressEmitMs: number | undefined;
      const onProgress = async (chunk: any) => {
        if (shouldThrottleProgress) {
          const now = Date.now();
          if (lastProgressEmitMs !== undefined && now - lastProgressEmitMs < progressThrottleMs!) return;
          lastProgressEmitMs = now;
        }
        await manager.publishLifecycleEvent('task.output', { ...task, chunk });
      };

      // In-step retry loop. We don't use `step.retries` because it's a static
      // workflow-definition value but `task.maxRetries` is per-task. The
      // engine-level retry features (backoff, retryableErrors predicate) are
      // intentionally dropped in v1.
      //
      // Seed `attempt` from `task.retryCount` so retries are durable across
      // suspend/resume — the workflow runtime restarts the step from the top
      // on resume, but `retryCount` was persisted between attempts.
      let lastError: any;
      for (let attempt = task.retryCount; attempt <= task.maxRetries; attempt++) {
        const abortController = new AbortController();
        manager.activeAbortControllers.set(taskId, abortController);
        // Wire the workflow's run-level abort signal into our local controller
        // so `workflow.getRun(taskId).cancel()` propagates to the executor.
        const onWorkflowAbort = () => abortController.abort(new Error('Task cancelled'));
        if (workflowAbortSignal.aborted) {
          abortController.abort(new Error('Task cancelled'));
        } else {
          workflowAbortSignal.addEventListener('abort', onWorkflowAbort, { once: true });
        }
        const timeoutHandle = setTimeout(() => {
          abortController.abort(new Error(`Task timed out after ${task.timeoutMs}ms`));
        }, task.timeoutMs);

        // Wrap the workflow runtime's `suspend` so we persist
        // `status: 'suspended'` + `suspendPayload`, fire the per-task
        // suspend hook (so the bg-task's `onResult` updates the agent's
        // message list), and publish the lifecycle event before
        // delegating. The runtime's `suspend` does not throw — it sets a
        // flag the step-executor reads after `execute` returns. We
        // capture the args here and call the runtime's suspend from the
        // step body after the executor returns, so `wrappedSuspend` can
        // safely run all its side effects synchronously inside the
        // tool's call.
        let pendingSuspend: { data?: unknown; suspendOptions?: SuspendOptions } | undefined;
        const wrappedSuspend = async (data?: unknown, suspendOptions?: SuspendOptions) => {
          await storage.updateTask(taskId, {
            status: 'suspended',
            suspendPayload: data,
            suspendedAt: new Date(),
          });
          const suspendedTask = await storage.getTask(taskId);
          if (suspendedTask) {
            // Suspend is non-terminal — DO NOT use `runLocalCompletionHooks`
            // here. That helper deregisters the task context in its `finally`
            // block, which would strand the resume call (the workflow step
            // body re-enters and looks up `manager.taskContexts.get(taskId)`).
            await manager.runLocalSuspendHooks(suspendedTask);
            await manager.publishLifecycleEvent('task.suspended', suspendedTask);
          }
          pendingSuspend = { data, suspendOptions };
        };

        try {
          const result = await ctx.executor.execute(task.args, {
            abortSignal: abortController.signal,
            onProgress,
            suspend: wrappedSuspend,
            // On resume the runtime populates `resumeData`; undefined on
            // the initial run.
            resumeData,
          });

          if (pendingSuspend) {
            return suspend(pendingSuspend.data, pendingSuspend.suspendOptions as SuspendOptions);
          }

          // Success path: persist
          // completed, run hooks, then publish terminal pubsub.
          const currentTask = await storage.getTask(taskId);
          if (!currentTask || (currentTask.status as BackgroundTaskStatus) === 'cancelled') {
            manager.deregisterTaskContext(taskId);
            return { result: undefined };
          }
          await storage.updateTask(taskId, { status: 'completed', result, completedAt: new Date() });
          const completedTask = await storage.getTask(taskId);
          if (completedTask) {
            await manager.runLocalCompletionHooks(completedTask, 'completed', { result });
            await manager.publishLifecycleEvent('task.completed', completedTask);
          }
          return { result };
        } catch (error: any) {
          const currentTask = await storage.getTask(taskId);
          if (!currentTask || (currentTask.status as BackgroundTaskStatus) === 'cancelled') {
            manager.deregisterTaskContext(taskId);
            return { result: undefined };
          }

          if (error?.name === 'AbortError' || error?.message === 'Task cancelled') {
            const status = currentTask.status as string;
            if (status !== 'timed_out' && status !== 'cancelled') {
              await storage.updateTask(taskId, {
                status: 'timed_out',
                error: { message: `Task timed out after ${task.timeoutMs}ms` },
                completedAt: new Date(),
              });
              const timedOutTask = await storage.getTask(taskId);
              if (timedOutTask) await manager.publishLifecycleEvent('task.failed', timedOutTask);
            }
            return { result: undefined };
          }

          lastError = error;
          if (attempt < task.maxRetries) {
            await storage.updateTask(taskId, {
              retryCount: attempt + 1,
              error: undefined,
              startedAt: new Date(),
            });
            continue;
          }

          const errorInfo = { message: error?.message ?? 'Unknown error', stack: error?.stack };
          await storage.updateTask(taskId, { status: 'failed', error: errorInfo, completedAt: new Date() });
          const failedTask = await storage.getTask(taskId);
          if (failedTask) {
            await manager.runLocalCompletionHooks(failedTask, 'failed', { error: errorInfo });
            await manager.publishLifecycleEvent('task.failed', failedTask);
          }
          throw error;
        } finally {
          clearTimeout(timeoutHandle);
          workflowAbortSignal.removeEventListener('abort', onWorkflowAbort);
          manager.activeAbortControllers.delete(taskId);
        }
      }

      // Should be unreachable — the loop returns or throws on every path.
      throw lastError ?? new Error('background-task execute step exited unexpectedly');
    },
  });

  return createWorkflow({
    id: BACKGROUND_TASK_WORKFLOW_ID,
    inputSchema,
    outputSchema,
    steps: [executeStep],
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => WORKFLOW_STATUS_TO_PERSIST.includes(workflowStatus),
    },
  })
    .then(executeStep)
    .commit();
}
