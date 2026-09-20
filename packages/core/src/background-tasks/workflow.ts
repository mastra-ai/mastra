import { z } from 'zod';
import { TOOL_PERMISSION_DENIED_ERROR_NAME } from '../agent/tool-permission-prefilter';
import { InternalSpans } from '../observability';
import { createStep, createWorkflow } from '../workflows';
import type { SuspendOptions } from '../workflows';
import type { BackgroundTaskManager } from './manager';
import { BACKGROUND_TASK_SHUTDOWN_ABORT_MESSAGE } from './shutdown';
import type { BackgroundTaskStatus } from './types';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

export { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

const inputSchema = z.object({ taskId: z.string() });

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
 * Builds the per-task workflow that owns executor + retries.
 *
 * Uses the standard (default) execution engine so the workflow runs entirely
 * in-process on whichever background-task worker calls `run.start()`. This is
 * critical for distributed deployments: routing through the evented pipeline
 * would introduce another competing-consumer hop that could move execution to
 * an orchestration worker or API process without the internal workflow or
 * invocation-bound task context registered.
 *
 * A single `run-attempt` step is the `dountil` body. It invokes the executor,
 * persists the outcome, advances retry bookkeeping, and returns whether the
 * loop is done. Keeping the durable loop body as a step gives each retry the
 * outer run's iteration identity; a nested durable workflow would need a
 * separate iteration-scoped ownership contract before it could be replayed
 * safely.
 *
 * Step bodies close over `manager` directly — the bg-tasks layer is the only
 * consumer of the `@internal` private fields.
 */
export function buildBackgroundTaskWorkflow(manager: BackgroundTaskManager) {
  const runAttemptStep = createStep({
    id: 'run-attempt',
    inputSchema: bodyIOSchema,
    outputSchema: bodyOutputSchema,
    execute: async ({ inputData, abortSignal: workflowAbortSignal, suspend, resumeData, suspendData }) => {
      const { taskId } = inputData;
      const storage = await manager.getStorage();
      const task = await storage.getTask(taskId);
      if (!task || task.status === 'cancelled') {
        manager.deregisterTaskContext(taskId);
        return { taskId, done: true };
      }
      if (manager.isShuttingDown()) {
        manager.deregisterTaskContext(taskId);
        return { taskId, done: true };
      }

      // Resolve the executor. Two paths:
      //   1. Per-task `TaskContext` registered on the producer (in-process).
      //      Carries closure-captured state (e.g. agent memory hooks) and
      //      wins when present.
      //   2. Static executor registered by tool name. Used by remote workers
      //      that received the dispatch via PubSub and don't have access to
      //      the producer's per-task closure. Agent-owned executors are
      //      namespaced as `agentId:toolName` to avoid cross-agent collisions;
      //      we try the namespaced key first, then fall back to the plain key.
      const ctx = manager.taskContexts.get(taskId);
      const executor =
        ctx?.executor ??
        (task.agentId ? manager.getStaticExecutor(`${task.agentId}:${task.toolName}`) : undefined) ??
        manager.getStaticExecutor(task.toolName);
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
        return { taskId, done: true };
      }

      // Throttled progress publisher.
      const progressThrottleMs = manager.config.progressThrottleMs;
      const shouldThrottleProgress =
        typeof progressThrottleMs === 'number' && Number.isFinite(progressThrottleMs) && progressThrottleMs > 0;
      let lastProgressEmitMs: number | undefined;
      const onProgress = async (chunk: any) => {
        if (shouldThrottleProgress) {
          const now = Date.now();
          if (lastProgressEmitMs !== undefined && now - lastProgressEmitMs < progressThrottleMs) return;
          lastProgressEmitMs = now;
        }
        await manager.publishLifecycleEvent('task.output', { ...task, chunk });
      };

      const abortController = new AbortController();
      if (!manager.registerActiveAbortController(taskId, abortController)) {
        manager.deregisterTaskContext(taskId);
        return { taskId, done: true };
      }
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
      const wasShutdownAbort = () =>
        abortController.signal.aborted &&
        abortController.signal.reason instanceof Error &&
        abortController.signal.reason.message === BACKGROUND_TASK_SHUTDOWN_ABORT_MESSAGE;

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
        if (wasShutdownAbort()) return;
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

      const persistAttemptOutcome = async ({
        outcome,
        result,
        error,
      }: {
        outcome: 'success' | 'retry' | 'failed' | 'cancelled' | 'timed_out';
        result?: unknown;
        error?: { name?: string; message: string; stack?: string };
      }) => {
        const currentTask = await storage.getTask(taskId);
        if (!currentTask) return { taskId, done: true };

        if (outcome === 'cancelled') {
          manager.deregisterTaskContext(taskId);
          return { taskId, done: true };
        }

        if (outcome === 'timed_out') {
          const status = currentTask.status as string;
          if (status !== 'timed_out' && status !== 'cancelled') {
            await storage.updateTask(taskId, {
              status: 'timed_out',
              error: { message: `Task timed out after ${currentTask.timeoutMs}ms` },
              completedAt: new Date(),
            });
            const timedOutTask = await storage.getTask(taskId);
            if (timedOutTask) await manager.publishLifecycleEvent('task.failed', timedOutTask);
          }
          return { taskId, done: true };
        }

        if (outcome === 'success') {
          if ((currentTask.status as BackgroundTaskStatus) === 'cancelled') {
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

        // outcome === 'retry' | 'failed' — authorization denials ('failed')
        // are non-retryable and fall through to the terminal-failure persist.
        if (outcome === 'retry' && currentTask.retryCount < currentTask.maxRetries) {
          await storage.updateTask(taskId, {
            retryCount: currentTask.retryCount + 1,
            error: undefined,
            startedAt: new Date(),
          });
          return { taskId, done: false };
        }

        // A tool failure is a modeled background-task result, not an engine
        // failure. Persist it and end the loop cleanly; throwing from a loop
        // body would ask the workflow engine to retry the transition itself.
        const errorInfo = error ?? { message: 'Unknown error' };
        await storage.updateTask(taskId, { status: 'failed', error: errorInfo, completedAt: new Date() });
        const failedTask = await storage.getTask(taskId);
        if (failedTask) {
          await manager.runLocalCompletionHooks(failedTask, 'failed', { error: errorInfo });
          await manager.publishLifecycleEvent('task.failed', failedTask);
        }
        return { taskId, done: true };
      };

      let outcome: 'success' | 'retry' | 'failed' | 'cancelled' | 'timed_out';
      let attemptResult: unknown;
      let attemptError: { name?: string; message: string; stack?: string } | undefined;
      try {
        const args = { ...task.args };
        const suspendedToolRunId = (suspendData as { suspendedToolRunId?: unknown } | undefined)?.suspendedToolRunId;
        if (resumeData !== undefined && !args.suspendedToolRunId && typeof suspendedToolRunId === 'string') {
          args.suspendedToolRunId = suspendedToolRunId;
        }

        attemptResult = await manager.runWithTaskExecutionContext(taskId, task.agentId, () =>
          executor.execute(args, {
            abortSignal: abortController.signal,
            onProgress,
            suspend: wrappedSuspend,
            // On resume the runtime populates `resumeData`; undefined on
            // the initial run.
            resumeData,
          }),
        );

        if (pendingSuspend) {
          // Agent-as-tool delegations carry the nested sub-agent's runId in
          // `suspendOptions.runId` (with `isAgentSuspend: true`), never in the
          // suspend payload. The resume path above restores it from the step's
          // persisted `suspendData.suspendedToolRunId`, so bridge it into the
          // engine suspend data here. Keep the user-facing `suspendPayload`
          // stored above untouched — this only augments the internal snapshot.
          const opts = pendingSuspend.suspendOptions;
          const agentRunId = opts?.isAgentSuspend && typeof opts.runId === 'string' ? opts.runId : undefined;
          const engineData = !agentRunId
            ? pendingSuspend.data
            : pendingSuspend.data && typeof pendingSuspend.data === 'object'
              ? { ...(pendingSuspend.data as Record<string, unknown>), suspendedToolRunId: agentRunId }
              : { suspendedToolRunId: agentRunId };
          return suspend(engineData, opts as SuspendOptions);
        }

        if (wasShutdownAbort()) {
          manager.deregisterTaskContext(taskId);
          outcome = 'cancelled';
        } else {
          outcome = 'success';
        }
      } catch (error: any) {
        const currentTask = await storage.getTask(taskId);
        if (!currentTask || currentTask.status === 'cancelled') {
          manager.deregisterTaskContext(taskId);
          outcome = 'cancelled';
        } else if (wasShutdownAbort()) {
          // Shutdown aborts are local process teardown, not task timeouts.
          manager.deregisterTaskContext(taskId);
          outcome = 'cancelled';
        } else if (
          abortController.signal.aborted ||
          error?.name === 'AbortError' ||
          error?.message === 'Task cancelled' ||
          error?.message?.startsWith('Task timed out after ')
        ) {
          outcome = 'timed_out';
        } else if (error?.name === 'FGADeniedError' || error?.name === TOOL_PERMISSION_DENIED_ERROR_NAME) {
          // Authorization denials are non-retryable — retrying cannot succeed
          // and would just burn attempts before surfacing the denial.
          outcome = 'failed';
          attemptError = { name: error.name, message: error?.message ?? 'Authorization denied', stack: error?.stack };
        } else {
          outcome = 'retry';
          attemptError = { message: error?.message ?? 'Unknown error', stack: error?.stack };
        }
      } finally {
        clearTimeout(timeoutHandle);
        workflowAbortSignal.removeEventListener('abort', onWorkflowAbort);
        manager.activeAbortControllers.delete(taskId);
      }

      return persistAttemptOutcome({ outcome, result: attemptResult, error: attemptError });
    },
  });

  return createWorkflow({
    id: BACKGROUND_TASK_WORKFLOW_ID,
    inputSchema,
    outputSchema: bodyOutputSchema,
    steps: [runAttemptStep],
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => WORKFLOW_STATUS_TO_PERSIST.includes(workflowStatus),
      tracingPolicy: { internal: InternalSpans.WORKFLOW },
    },
  })
    .dountil(runAttemptStep, async ({ inputData }) => inputData?.done === true)
    .commit();
}
