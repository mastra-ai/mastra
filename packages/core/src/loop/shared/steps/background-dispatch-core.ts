import { createBackgroundTask } from '../../../background-tasks/create';
import type { BackgroundTaskManager } from '../../../background-tasks/manager';
import { resolveBackgroundConfig } from '../../../background-tasks/resolve-config';
import type {
  AgentBackgroundConfig,
  BackgroundExecutionDisposition,
  BackgroundTask,
  BackgroundTaskHandle,
  BackgroundTaskManagerConfig,
  CreateBackgroundTaskOptions,
  ToolBackgroundConfig,
} from '../../../background-tasks/types';
import type { IMastraLogger } from '../../../logger';

export type BackgroundDispatchOutcome =
  /** Background execution does not apply (or dispatch fell through) — run the tool synchronously. */
  | { status: 'sync' }
  /** The tool call is now owned by a background task; engines return the
   * placeholder as the tool result so the LLM can continue — unless the
   * resolved `disposition` is `awaited`, in which case engines block the turn
   * on `waitForCompletion()` and return the authoritative result instead. */
  | {
      status: 'started' | 'resumed' | 'restarted' | 'reattached' | 'reconciled';
      taskId: string;
      placeholder: string;
      /** The resolved execution disposition (never `foreground` here — that
       * resolves to `runInBackground: false` and returns `sync` above). */
      disposition: BackgroundExecutionDisposition;
      /** Blocks until the dispatched task reaches a terminal state. Engines
       * use this to honor the `awaited` disposition. */
      waitForCompletion: BackgroundTaskHandle['waitForCompletion'];
    };

/** Per-dispatch info the ladder passes to the engine's lazy `taskContext`
 * builder so engine hooks can see the resolved disposition and the task id
 * (which only exists once the ladder has created/dispatched the task). */
export interface BackgroundTaskContextInfo {
  disposition: BackgroundExecutionDisposition;
  getTaskId: () => string | undefined;
}

/**
 * Shared background dispatch ladder: decide whether a tool
 * call runs as a background task and, if so, resume/restart/dispatch it.
 * Engines own the per-task context hooks (executor, onChunk, onResult,
 * onExecution — they close over engine transport and message-list state) and
 * how the placeholder projects onto their step output.
 *
 * The mechanics are shared; two rungs are per-engine policy (both required
 * params, so every call site's choice is explicit):
 *
 * - `existingRunningTask`: `'restart'` (durable) probes
 *   `checkIfRunning` before dispatching and restarts an already-running task
 *   for this toolCallId to reattach hooks — durable step redelivery
 *   legitimately re-enters dispatch for the same toolCallId after a crash,
 *   and dispatching again would duplicate background work on every
 *   recovery. `'dispatch-duplicate'` (default engine) skips the probe
 *   entirely and goes straight to `dispatch()` — the released in-process
 *   contract; default dispatch is only re-entered by caller action, never
 *   by transport redelivery, so the dedup problem doesn't exist and the
 *   probe would add a storage read per dispatch that the released path
 *   never made.
 * - `dispatchFailure`: `'fallback-to-sync'` (durable) degrades any
 *   ladder failure (task creation, storage lookups, dispatch) to
 *   synchronous execution — durable dispatch crosses transport/store
 *   boundaries where transient failure is expected, and sync fallback
 *   preserves forward progress. `'propagate'` (default engine) rethrows so
 *   the failure surfaces as a tool error — the released contract; a tool
 *   may be background *because* synchronous execution is unsafe, slow, or
 *   process-affine, and an in-process dispatch failure indicates a
 *   config/programmer error that silent sync execution would mask.
 *
 * Unconditional on both policies (each with pre-PR provenance on its own
 * engine):
 * - Started-chunk emission is best-effort: previously the durable engine
 *   awaited its pubsub publish inside the ladder, so a transport failure
 *   *after* dispatch fell back to sync and executed the tool twice.
 * - The suspended-task lookup only runs when a resume payload is present
 *   (durable's gating; the main loop looked it up unconditionally but only
 *   consumed the answer when resuming, so this is observably identical).
 *   Nullish, not truthy: a tool with a primitive resumeSchema can be resumed
 *   with `false` / `0` / `''`, and treating those as "no resume data" would
 *   fall through to `dispatch()`, stranding the suspended task and starting
 *   a second one.
 * - The `adoptPersistedTask` replay-adoption block (durable-only via its
 *   existing flag, #24418) and the concurrency-limit `fallbackToSync` rung
 *   (both engines' released contract).
 */
export async function dispatchBackgroundTool(deps: {
  backgroundTaskManager: BackgroundTaskManager | undefined;
  agentBackgroundConfig: AgentBackgroundConfig | undefined;
  managerConfig: BackgroundTaskManagerConfig | undefined;
  toolBackgroundConfig: ToolBackgroundConfig | undefined;
  /** The LLM's per-call `_background` override (already stripped from args). */
  llmBgOverrides: unknown;
  /** Tool args with `_background` removed. Non-object args never dispatch. */
  args: unknown;
  toolName: string;
  toolCallId: string;
  agentId: string;
  threadId: string | undefined;
  resourceId: string | undefined;
  runId: string;
  /** Resume payload for a previously-suspended background task; engines pass
   * their own pre-gated value (undefined when this leg is not a resume). */
  resumeData: unknown;
  /** Per-task hooks: executor + stream/result/execution injectors. Lazy: only
   * built once background dispatch is actually chosen (the main loop's
   * executor resolution can throw for tools its bg lookup can't see, which
   * now degrades to sync execution instead of failing the call). Receives the
   * resolved disposition and a task-id accessor so hooks can stamp background
   * work context / terminal notifications. */
  taskContext: (info: BackgroundTaskContextInfo) => CreateBackgroundTaskOptions['context'];
  /** Emit the background-task-started chunk over engine transport. */
  emitTaskStarted: (task: { id: string }) => void | Promise<void>;
  /** Durable workflow steps may replay after the task reached persisted storage. */
  adoptPersistedTask?: boolean;
  /**
   * What to do when a task for this toolCallId is already running:
   * `'restart'` (durable: redelivery dedup) probes
   * `checkIfRunning` and restarts to reattach hooks; `'dispatch-duplicate'`
   * (default engine: released contract) skips the probe entirely.
   */
  existingRunningTask: 'restart' | 'dispatch-duplicate';
  /**
   * What to do when the dispatch ladder throws:
   * `'fallback-to-sync'` (durable: forward progress across transport/store
   * failures) degrades to synchronous execution; `'propagate'` (default
   * engine: released contract) rethrows so the failure surfaces as a tool
   * error.
   */
  dispatchFailure: 'fallback-to-sync' | 'propagate';
  logger?: IMastraLogger;
}): Promise<BackgroundDispatchOutcome> {
  const { backgroundTaskManager, toolName, toolCallId, agentId, threadId, resourceId, runId, logger } = deps;

  // Skip background dispatch entirely when disabled (e.g., for sub-agents whose
  // entire invocation is itself dispatched as a background task by the parent).
  if (
    !backgroundTaskManager ||
    deps.agentBackgroundConfig?.disabled ||
    typeof deps.args !== 'object' ||
    deps.args === null
  ) {
    return { status: 'sync' };
  }

  const bgResolved = resolveBackgroundConfig({
    llmBgOverrides: deps.llmBgOverrides as Record<string, unknown>,
    toolName,
    toolConfig: deps.toolBackgroundConfig,
    agentConfig: deps.agentBackgroundConfig,
    managerConfig: deps.managerConfig,
  });

  if (!bgResolved.runInBackground) {
    return { status: 'sync' };
  }

  const placeholder = (verb: 'started' | 'resumed' | 'restarted' | 'reattached' | 'reconciled', taskId: string) =>
    `Background task ${verb}. Task ID: ${taskId}. The tool "${toolName}" is running in the background. You will be notified when it completes.`;

  let failClosed = false;
  try {
    // The handle is created below, but engine hooks (built first, as task
    // context) need lazy access to the task id — `bgTask.task` throws until
    // the ladder has dispatched/resumed/restarted, by which point the hooks
    // that read it (executor, onResult) are guaranteed to run post-dispatch.
    let bgTask: BackgroundTaskHandle | undefined;
    const info: BackgroundTaskContextInfo = {
      disposition: bgResolved.disposition,
      getTaskId: () => {
        try {
          return bgTask?.task.id;
        } catch {
          return undefined;
        }
      },
    };
    const context = deps.taskContext(info);
    bgTask = createBackgroundTask(backgroundTaskManager, {
      toolName,
      toolCallId,
      args: deps.args as Record<string, unknown>,
      agentId,
      threadId,
      resourceId,
      runId,
      timeoutMs: bgResolved.timeoutMs,
      maxRetries: bgResolved.maxRetries,
      context,
    });
    const handle = bgTask;
    const dispatched = (status: 'started' | 'resumed' | 'restarted' | 'reattached' | 'reconciled', taskId: string) => ({
      status,
      taskId,
      placeholder: placeholder(status, taskId),
      disposition: bgResolved.disposition,
      waitForCompletion: handle.waitForCompletion.bind(handle),
    });

    if (deps.adoptPersistedTask && bgResolved.disposition === 'awaited') {
      // The background task and the workflow step checkpoint independently. On
      // replay, adopt the exact persisted invocation before looking at its
      // status so a pending-to-running or running-to-terminal transition cannot
      // make the step dispatch a duplicate. Recovery failures are ambiguous, so
      // fail closed rather than falling through to synchronous execution.
      failClosed = true;
      const identity = { toolCallId, runId, agentId, threadId, resourceId, toolName };
      const isTerminal = (task: BackgroundTask) =>
        task.status === 'completed' ||
        task.status === 'failed' ||
        task.status === 'cancelled' ||
        task.status === 'timed_out';
      const reconcileTerminalTask = async (task: BackgroundTask) => {
        if (!context.onResult) {
          throw new Error(`Cannot reconcile awaited background task "${task.id}" without an onResult hook`);
        }
        const completed = task.status === 'completed';
        await context.onResult({
          runId: task.runId,
          taskId: task.id,
          toolCallId: task.toolCallId,
          toolName: task.toolName,
          agentId: task.agentId,
          threadId: task.threadId,
          resourceId: task.resourceId,
          result: task.result,
          error: completed
            ? undefined
            : (task.error ?? {
                message: `Background task ${task.status.replace('_', ' ')}: ${task.id}`,
              }),
          status: completed ? 'completed' : 'failed',
          startedAt: task.startedAt ?? task.createdAt,
          completedAt: task.completedAt ?? task.createdAt,
        });
        return dispatched('reconciled', task.id);
      };

      const existingTask = await bgTask.checkIfExisting(identity);
      if (existingTask) {
        if (isTerminal(existingTask)) {
          return reconcileTerminalTask(existingTask);
        }

        if (existingTask.status === 'suspended') {
          if (deps.resumeData != null) {
            const task = await bgTask.resume(deps.resumeData);
            return dispatched('resumed', task.id);
          }
          return dispatched('reattached', existingTask.id);
        }

        try {
          const task = await bgTask.restart();
          return dispatched('restarted', task.id);
        } catch (restartError) {
          const transitionedTask = await bgTask.checkIfExisting(identity);
          if (transitionedTask?.id === existingTask.id && isTerminal(transitionedTask)) {
            return reconcileTerminalTask(transitionedTask);
          }
          throw restartError;
        }
      }
      failClosed = false;
    }

    // Resuming this tool call with a previously-suspended background task for
    // the same toolCallId+runId: resume it with the agent-resume payload
    // instead of dispatching a fresh one.
    if (deps.resumeData != null) {
      const isSuspended = await bgTask.checkIfSuspended({ toolCallId, runId, agentId, threadId, resourceId, toolName });
      if (isSuspended) {
        const task = await bgTask.resume(deps.resumeData);
        return dispatched('resumed', task.id);
      }
    }

    // Durable only ('restart'): a task for this toolCallId+runId is
    // already running (e.g. the step was redelivered after a process
    // restart): restart it to reattach the per-stream hooks instead of
    // dispatching a duplicate. The default engine
    // ('dispatch-duplicate') skips the probe entirely — its dispatch is
    // never redelivered, and the released contract made no storage read
    // here.
    if (deps.existingRunningTask === 'restart') {
      const isPreviouslyRunning = await bgTask.checkIfRunning({
        toolCallId,
        runId,
        agentId,
        threadId,
        resourceId,
        toolName,
      });
      if (isPreviouslyRunning) {
        const task = await bgTask.restart();
        return dispatched('restarted', task.id);
      }
    }

    const { task, fallbackToSync } = await bgTask.dispatch();
    if (fallbackToSync) {
      // Concurrency limit hit — fall through to synchronous execution.
      return { status: 'sync' };
    }

    // Best-effort: the task is already dispatched, so an emission failure must
    // not fall through to sync (that would execute the tool twice).
    try {
      await deps.emitTaskStarted(task);
    } catch (emitError) {
      logger?.warn?.('Error emitting background-task-started', { toolCallId, toolName, error: emitError });
    }

    return dispatched('started', task.id);
  } catch (bgError) {
    // Adopt-persisted recovery failures (#24418) are ambiguous and fail
    // closed regardless of the dispatchFailure policy.
    if (failClosed) {
      throw bgError;
    }
    // Default engine ('propagate'): surface the dispatch failure as
    // a tool error (released contract; silent sync execution could run a
    // tool that is background precisely because sync is unsafe). Durable
    // ('fallback-to-sync'): degrade to synchronous execution to preserve
    // forward progress across transport/store failures.
    if (deps.dispatchFailure === 'propagate') {
      throw bgError;
    }
    logger?.debug?.(`Background task dispatch failed for ${toolName}, falling back to sync: ${bgError}`);
    return { status: 'sync' };
  }
}
