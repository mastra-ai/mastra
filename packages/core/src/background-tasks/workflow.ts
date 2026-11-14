import { z } from 'zod';
import { resolveSuspendedToolRunId } from '../agent/utils';
import { InternalSpans } from '../observability';
import { slimProgressChunk } from '../stream/strip-model-snapshots';
import { createStep, createWorkflow } from '../workflows';
import type { SuspendOptions } from '../workflows';
import type { BackgroundTaskManager } from './manager';
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
 * Builds the per-task workflow that owns executor + retries.
 *
 * Uses the standard (default) execution engine so the workflow runs entirely
 * in-process on whichever background-task worker calls `run.start()`. This is
 * critical for distributed deployments: routing through the evented pipeline
 * would introduce another competing-consumer hop that could move execution to
 * an orchestration worker or API process without the internal workflow or
 * invocation-bound task context registered.
 *
 * Shape: outer workflow runs an inner `[run-attempt, classify-outcome]`
 * workflow inside a `dountil` loop. `run-attempt` invokes the executor and
 * categorises the outcome; `classify-outcome` persists final state, advances
 * retry bookkeeping, and decides whether the loop is done. The dountil
 * predicate exits on `done === true`.
 *
 * Step bodies close over `manager` directly — the bg-tasks layer is the only
 * consumer of the `@internal` private fields.
 */
export function buildBackgroundTaskWorkflow(manager: BackgroundTaskManager) {
  const runAttemptStep = createStep({
    id: 'run-attempt',
    inputSchema: bodyIOSchema,
    outputSchema: attemptOutputSchema,
    execute: async ({ inputData, abortSignal: workflowAbortSignal, suspend, resumeData, suspendData }) => {
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
        // Fenced on ownership: a worker whose lease was superseded must not
        // commit a terminal state for a task another worker now owns.
        const markedFailed = await storage.updateTask(
          taskId,
          {
            status: 'failed',
            error: errorInfo,
            completedAt: new Date(),
            ownerId: undefined,
            leaseExpiresAt: undefined,
          },
          { expectedOwnerId: manager.ownerId },
        );
        if (markedFailed) {
          const failedTask = await storage.getTask(taskId);
          if (failedTask) {
            await manager.runLocalCompletionHooks(failedTask, 'failed', { error: errorInfo });
            await manager.publishLifecycleEvent('task.failed', failedTask);
          }
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
          if (lastProgressEmitMs !== undefined && now - lastProgressEmitMs < progressThrottleMs) return;
          lastProgressEmitMs = now;
        }
        await manager.publishLifecycleEvent('task.output', { ...task, chunk: slimProgressChunk(chunk) });
      };

      const abortController = new AbortController();
      if (!manager.registerActiveAbortController(taskId, abortController)) {
        manager.deregisterTaskContext(taskId);
        return { taskId, outcome: 'cancelled' as const };
      }
      // Wire the workflow's run-level abort signal into our local controller
      // so `workflow.getRun(taskId).cancel()` propagates to the executor.
      const onWorkflowAbort = () => abortController.abort(new Error('Task cancelled'));
      if (workflowAbortSignal.aborted) {
        abortController.abort(new Error('Task cancelled'));
      } else {
        workflowAbortSignal.addEventListener('abort', onWorkflowAbort, { once: true });
      }
      const timeoutHandle =
        task.timeoutMs === 0
          ? undefined
          : setTimeout(() => {
              abortController.abort(new Error(`Task timed out after ${task.timeoutMs}ms`));
            }, task.timeoutMs);

      // Capture the tool's `suspend` call; the step body suspends the run
      // after the executor returns. The manager stores the task as
      // `suspended`, runs the suspend hooks and publishes `task.suspended`
      // only once the run's suspended snapshot is saved, so a stored
      // suspension can always be resumed. Recording the payload right away
      // also tells shutdown not to cancel a task that has asked (#30226).
      let pendingSuspend: { data?: unknown; suspendOptions?: SuspendOptions } | undefined;
      const wrappedSuspend = async (data?: unknown, suspendOptions?: SuspendOptions) => {
        pendingSuspend = { data, suspendOptions };
        manager.noteSuspendRequested(taskId, data);
      };
      const suspendRun = async ({ data, suspendOptions }: { data?: unknown; suspendOptions?: SuspendOptions }) => {
        // A worker whose task was cancelled or taken over must not save its
        // suspension over what the task holds now.
        const current = await storage.getTask(taskId);
        if (current?.status !== 'running' || current.ownerId !== manager.ownerId) {
          return { taskId, outcome: 'cancelled' as const };
        }
        // Agent-as-tool delegations carry the nested sub-agent's runId in
        // `suspendOptions.runId` (with `isAgentSuspend: true`), never in the
        // suspend payload. The resume path below restores it from the step's
        // persisted `suspendData.suspendedToolRunId`, so bridge it into the
        // engine suspend data here. Keep the user-facing `suspendPayload`
        // stored by the manager untouched — this only augments the internal snapshot.
        const agentRunId =
          suspendOptions?.isAgentSuspend && typeof suspendOptions.runId === 'string' ? suspendOptions.runId : undefined;
        const engineData = !agentRunId
          ? data
          : data && typeof data === 'object'
            ? { ...(data as Record<string, unknown>), suspendedToolRunId: agentRunId }
            : { suspendedToolRunId: agentRunId };
        return suspend(engineData, suspendOptions as SuspendOptions);
      };

      try {
        const args = { ...task.args };
        delete args.suspendedToolRunId;
        const suspendedToolRunId = resolveSuspendedToolRunId(
          (suspendData as { suspendedToolRunId?: unknown } | undefined)?.suspendedToolRunId,
        );
        if (resumeData !== undefined && suspendedToolRunId) {
          args.suspendedToolRunId = suspendedToolRunId;
        }
        // The payload this task suspended with, so the resumed tool knows which
        // request it is answering. The step's suspend data may carry the internal
        // `suspendedToolRunId` bridge (see below); strip it back off.
        let suspendPayload: unknown = suspendData;
        if (suspendPayload && typeof suspendPayload === 'object' && 'suspendedToolRunId' in suspendPayload) {
          const { suspendedToolRunId: _bridge, ...rest } = suspendPayload as Record<string, unknown>;
          suspendPayload = Object.keys(rest).length > 0 ? rest : undefined;
        }

        const result = await executor.execute(args, {
          abortSignal: abortController.signal,
          onProgress,
          suspend: wrappedSuspend,
          // On resume the runtime populates `resumeData`; undefined on
          // the initial run.
          resumeData,
          suspendedToolRunId: resumeData !== undefined ? suspendedToolRunId : undefined,
          suspendPayload: resumeData !== undefined ? suspendPayload : undefined,
        });

        if (pendingSuspend) return suspendRun(pendingSuspend);

        return { taskId, outcome: 'success' as const, result };
      } catch (error: any) {
        const currentTask = await storage.getTask(taskId);
        if (!currentTask || currentTask.status === 'cancelled') {
          manager.deregisterTaskContext(taskId);
          return { taskId, outcome: 'cancelled' as const };
        }

        // Graceful process shutdown is not a task failure. Leave storage at
        // `running` so retryable tasks can be recovered by the next process;
        // non-retryable tasks are persisted as cancelled by manager.shutdown().
        if (manager.isShuttingDown()) {
          // A tool that asked before shutdown aborted it keeps its question.
          if (pendingSuspend) return suspendRun(pendingSuspend);
          manager.deregisterTaskContext(taskId);
          return { taskId, outcome: 'cancelled' as const };
        }

        // Treat any aborted-signal exit as a timeout. The cancel path is
        // already handled by the storage-status check above, so if we reach
        // here with `signal.aborted`, it's the timeout abort. The message
        // checks cover executors that rethrow our abort reason. An executor's
        // own `AbortError` while our signal is live is an ordinary failure.
        if (
          abortController.signal.aborted ||
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
          const marked = await storage.updateTask(
            taskId,
            {
              status: 'timed_out',
              error: { message: `Task timed out after ${task.timeoutMs}ms` },
              completedAt: new Date(),
              ownerId: undefined,
              leaseExpiresAt: undefined,
            },
            { expectedStatus: 'running', expectedOwnerId: manager.ownerId },
          );
          if (marked) {
            const timedOutTask = await storage.getTask(taskId);
            if (timedOutTask) await manager.publishLifecycleEvent('task.failed', timedOutTask);
          }
        }
        return { taskId, done: true };
      }

      if (outcome === 'success') {
        if (task.status === 'cancelled') {
          manager.deregisterTaskContext(taskId);
          return { taskId, done: true };
        }
        const completed = await storage.updateTask(
          taskId,
          {
            status: 'completed',
            result,
            completedAt: new Date(),
            ownerId: undefined,
            leaseExpiresAt: undefined,
          },
          { expectedStatus: 'running', expectedOwnerId: manager.ownerId },
        );
        if (completed) {
          const completedTask = await storage.getTask(taskId);
          if (completedTask) {
            await manager.runLocalCompletionHooks(completedTask, 'completed', { result });
            await manager.publishLifecycleEvent('task.completed', completedTask);
          }
        }
        return { taskId, done: true, result };
      }

      // outcome === 'retry' | 'failed'
      if (outcome === 'retry' && task.retryCount < task.maxRetries) {
        // Still `running` and still ours — fence so a superseded worker stops
        // looping instead of racing the current owner's retries.
        const advanced = await storage.updateTask(
          taskId,
          {
            retryCount: task.retryCount + 1,
            error: undefined,
            startedAt: new Date(),
          },
          { expectedStatus: 'running', expectedOwnerId: manager.ownerId },
        );
        if (!advanced) return { taskId, done: true };
        return { taskId, done: false };
      }

      // Retries exhausted (or non-retryable failure): persist failure and
      // throw so the workflow run ends
      // in `failed` rather than completing cleanly. Throw matches the prior
      // single-step behavior — workflow-run history stays accurate.
      const errorInfo = error ?? { message: 'Unknown error' };
      const marked = await storage.updateTask(
        taskId,
        {
          status: 'failed',
          error: errorInfo,
          completedAt: new Date(),
          ownerId: undefined,
          leaseExpiresAt: undefined,
        },
        { expectedStatus: 'running', expectedOwnerId: manager.ownerId },
      );
      if (marked) {
        const failedTask = await storage.getTask(taskId);
        if (failedTask) {
          await manager.runLocalCompletionHooks(failedTask, 'failed', { error: errorInfo });
          await manager.publishLifecycleEvent('task.failed', failedTask);
        }
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
