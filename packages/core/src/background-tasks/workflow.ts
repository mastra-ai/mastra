import { z } from 'zod';
import { InternalSpans } from '../observability';
import type { SuspendOptions } from '../workflows';
import { createStep, createWorkflow } from '../workflows/evented';
import type { BackgroundTaskManager } from './manager';
import type { BackgroundTaskStatus } from './types';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

export { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

const inputSchema = z.object({ taskId: z.string() });

const attemptOutcomeSchema = z.enum(['success', 'retry', 'failed', 'cancelled', 'timed_out']);

const attemptOutputSchema = z.object({
  taskId: z.string(),
  outcome: attemptOutcomeSchema,
  result: z.unknown().optional(),
  error: z.any().optional(),
});

const bodyIOSchema = z.object({
  taskId: z.string(),
  done: z.boolean().optional(),
  result: z.unknown().optional(),
});

const bodyOutputSchema = z.object({
  taskId: z.string(),
  done: z.boolean(),
  result: z.unknown().optional(),
});

const WORKFLOW_STATUS_TO_PERSIST = ['suspended', 'pending', 'paused', 'waiting'];

/**
 * Builds the per-task evented workflow that owns executor + retries.
 *
 * Shape: outer workflow runs an inner `[run-attempt, classify-outcome]`
 * workflow inside a `dountil` loop. `run-attempt` invokes the executor and
 * categorises the outcome; `classify-outcome` persists final state, advances
 * retry bookkeeping, and decides whether the loop is done. The dountil
 * predicate exits on `done === true`.
 *
 * The nested-workflow-as-loop-body path lives in
 * `processWorkflowEnd → processWorkflowLoop` and was fixed in PR #16312.
 * Suspend/resume routes through the runtime's nested-workflow auto-detect
 * (`processWorkflowStepRun` resume branch).
 *
 * Step bodies close over `manager` directly — the bg-tasks layer is the only
 * consumer of the `@internal` private fields.
 */
export function buildBackgroundTaskWorkflow(manager: BackgroundTaskManager) {
  const runAttemptStep = createStep({
    id: 'run-attempt',
    inputSchema: bodyIOSchema,
    outputSchema: attemptOutputSchema,
    execute: async ({ inputData, abortSignal: workflowAbortSignal, suspend, resumeData }) => {
      const { taskId } = inputData;
      const storage = await manager.getStorage();
      const task = await storage.getTask(taskId);
      if (!task || task.status === 'cancelled') {
        manager.deregisterTaskContext(taskId);
        return { taskId, outcome: 'cancelled' as const };
      }

      // Resolve the executor. Two paths:
      //   1. Per-task `TaskContext` registered on the producer (in-process).
      //      Carries closure-captured state (e.g. agent memory hooks) and
      //      wins when present.
      //   2. Static executor registered by tool name. Used by remote workers
      //      that received the dispatch via PubSub and don't have access to
      //      the producer's per-task closure.
      const ctx = manager.taskContexts.get(taskId);
      const executor = ctx?.executor ?? manager.getStaticExecutor(task.toolName);
      if (!executor) {
        const errorInfo = {
          message:
            `No executor registered for tool "${task.toolName}". ` +
            `Register the tool on Mastra (so workers can resolve it cross-process) ` +
            `or run the task in the same process as the producer.`,
        };
        await storage.updateTask(taskId, { status: 'failed', error: errorInfo, completedAt: new Date() });
        const failedTask = await storage.getTask(taskId);
        if (failedTask) {
          await manager.runLocalCompletionHooks(failedTask, 'failed', { error: errorInfo });
          await manager.publishLifecycleEvent('task.failed', failedTask);
        }
        manager.deregisterTaskContext(taskId);
        throw new Error(errorInfo.message);
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
        const result = await executor.execute(task.args, {
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

        return { taskId, outcome: 'success' as const, result };
      } catch (error: any) {
        const currentTask = await storage.getTask(taskId);
        if (!currentTask || (currentTask.status as BackgroundTaskStatus) === 'cancelled') {
          manager.deregisterTaskContext(taskId);
          return { taskId, outcome: 'cancelled' as const };
        }

        // Treat any aborted-signal exit as a timeout. The cancel path is
        // already handled by the storage-status check above, so if we reach
        // here with `signal.aborted`, it's the timeout abort. The
        // `AbortError` / message checks are belt-and-braces for executors
        // that throw their own abort error instead of propagating ours.
        if (
          abortController.signal.aborted ||
          error?.name === 'AbortError' ||
          error?.message === 'Task cancelled' ||
          error?.message?.startsWith('Task timed out after ')
        ) {
          return { taskId, outcome: 'timed_out' as const };
        }

        // Authorization denials are non-retryable — retrying cannot succeed
        // and would just burn attempts before surfacing the denial.
        if (error?.name === 'FGADeniedError') {
          return {
            taskId,
            outcome: 'failed' as const,
            error: { name: error.name, message: error?.message ?? 'Authorization denied', stack: error?.stack },
          };
        }

        return {
          taskId,
          outcome: 'retry' as const,
          error: { message: error?.message ?? 'Unknown error', stack: error?.stack },
        };
      } finally {
        clearTimeout(timeoutHandle);
        workflowAbortSignal.removeEventListener('abort', onWorkflowAbort);
        manager.activeAbortControllers.delete(taskId);
      }
    },
  });

  const classifyOutcomeStep = createStep({
    id: 'classify-outcome',
    inputSchema: attemptOutputSchema,
    outputSchema: bodyOutputSchema,
    execute: async ({ inputData }) => {
      const { taskId, outcome, result, error } = inputData;
      const storage = await manager.getStorage();
      const task = await storage.getTask(taskId);
      if (!task) return { taskId, done: true };

      if (outcome === 'cancelled') {
        manager.deregisterTaskContext(taskId);
        return { taskId, done: true };
      }

      if (outcome === 'timed_out') {
        const status = task.status as string;
        if (status !== 'timed_out' && status !== 'cancelled') {
          await storage.updateTask(taskId, {
            status: 'timed_out',
            error: { message: `Task timed out after ${task.timeoutMs}ms` },
            completedAt: new Date(),
          });
          const timedOutTask = await storage.getTask(taskId);
          if (timedOutTask) await manager.publishLifecycleEvent('task.failed', timedOutTask);
        }
        return { taskId, done: true };
      }

      if (outcome === 'success') {
        if ((task.status as BackgroundTaskStatus) === 'cancelled') {
          manager.deregisterTaskContext(taskId);
          return { taskId, done: true };
        }
        await storage.updateTask(taskId, { status: 'completed', result, completedAt: new Date() });
        const completedTask = await storage.getTask(taskId);
        if (completedTask) {
          await manager.runLocalCompletionHooks(completedTask, 'completed', { result });
          await manager.publishLifecycleEvent('task.completed', completedTask);
        }
        return { taskId, done: true, result };
      }

      // outcome === 'retry' | 'failed'
      if (outcome === 'retry' && task.retryCount < task.maxRetries) {
        await storage.updateTask(taskId, {
          retryCount: task.retryCount + 1,
          error: undefined,
          startedAt: new Date(),
        });
        return { taskId, done: false };
      }

      // Retries exhausted (or non-retryable failure): persist failure and
      // throw so the workflow run ends
      // in `failed` rather than completing cleanly. Throw matches the prior
      // single-step behavior — workflow-run history stays accurate.
      const errorInfo = error ?? { message: 'Unknown error' };
      await storage.updateTask(taskId, { status: 'failed', error: errorInfo, completedAt: new Date() });
      const failedTask = await storage.getTask(taskId);
      if (failedTask) {
        await manager.runLocalCompletionHooks(failedTask, 'failed', { error: errorInfo });
        await manager.publishLifecycleEvent('task.failed', failedTask);
      }
      const thrown = new Error(errorInfo.message);
      if (errorInfo.name) thrown.name = errorInfo.name;
      if (errorInfo.stack) thrown.stack = errorInfo.stack;
      throw thrown;
    },
  });

  const attemptBodyWorkflow = createWorkflow({
    id: `${BACKGROUND_TASK_WORKFLOW_ID}__attempt`,
    inputSchema: bodyIOSchema,
    outputSchema: bodyOutputSchema,
    steps: [runAttemptStep, classifyOutcomeStep],
    options: {
      // `dountil` feeds the prior iteration's output back in as input. The
      // body's actual entry point only needs `taskId`, but the loop's
      // feedback shape includes `done`/`result`/etc. Skip validation rather
      // than widen every step's input schema.
      validateInputs: false,
      shouldPersistSnapshot: ({ workflowStatus }) => WORKFLOW_STATUS_TO_PERSIST.includes(workflowStatus),
      // Internal scheduler plumbing — hide workflow spans from exported
      // traces. The task body itself runs as user code and keeps its own
      // spans.
      tracingPolicy: {
        internal: InternalSpans.WORKFLOW,
      },
    },
  })
    .then(runAttemptStep)
    .then(classifyOutcomeStep)
    .commit();

  return createWorkflow({
    id: BACKGROUND_TASK_WORKFLOW_ID,
    inputSchema,
    outputSchema: bodyOutputSchema,
    steps: [attemptBodyWorkflow],
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => WORKFLOW_STATUS_TO_PERSIST.includes(workflowStatus),
      // Internal scheduler plumbing — see the inner workflow comment.
      tracingPolicy: {
        internal: InternalSpans.WORKFLOW,
      },
    },
  })
    .dountil(attemptBodyWorkflow, async ({ inputData }) => inputData?.done === true)
    .commit();
}
