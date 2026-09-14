import { createBackgroundTask } from '../../../background-tasks/create';
import type { BackgroundTaskManager } from '../../../background-tasks/manager';
import { resolveBackgroundConfig } from '../../../background-tasks/resolve-config';
import type {
  AgentBackgroundConfig,
  BackgroundExecutionDisposition,
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
      status: 'started' | 'resumed' | 'restarted';
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
 * Shared background dispatch ladder (PHASE3 Step 4): decide whether a tool
 * call runs as a background task and, if so, resume/restart/dispatch it.
 * Engines own the per-task context hooks (executor, onChunk, onResult,
 * onExecution — they close over engine transport and message-list state) and
 * how the placeholder projects onto their step output.
 *
 * Adjudications:
 * - checkIfRunning → restart (ledger L5): previously durable-only. When the
 *   LLM replays a tool call whose background task is already running (e.g.
 *   resume after process restart), restarting reattaches hooks instead of
 *   dispatching a duplicate task.
 * - Dispatch-failure fallback-to-sync: previously durable-only. A failure
 *   anywhere in the ladder (task creation, storage lookups, dispatch) now
 *   degrades to synchronous execution on both engines instead of surfacing
 *   as a tool error for the LLM to retry.
 * - Started-chunk emission is best-effort: previously the durable engine
 *   awaited its pubsub publish inside the ladder, so a transport failure
 *   *after* dispatch fell back to sync and executed the tool twice.
 * - The suspended-task lookup now only runs when a resume payload is present
 *   (durable's gating; the main loop looked it up unconditionally but only
 *   consumed the answer when resuming, so this is observably identical).
 *   Nullish, not truthy: a tool with a primitive resumeSchema can be resumed
 *   with `false` / `0` / `''`, and treating those as "no resume data" would
 *   fall through to `dispatch()`, stranding the suspended task and starting
 *   a second one.
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

  const placeholder = (verb: 'started' | 'resumed' | 'restarted', taskId: string) =>
    `Background task ${verb}. Task ID: ${taskId}. The tool "${toolName}" is running in the background. You will be notified when it completes.`;

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
      context: deps.taskContext(info),
    });
    const handle = bgTask;
    const dispatched = (status: 'started' | 'resumed' | 'restarted', taskId: string) => ({
      status,
      taskId,
      placeholder: placeholder(status, taskId),
      disposition: bgResolved.disposition,
      waitForCompletion: handle.waitForCompletion.bind(handle),
    });

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

    // A task for this toolCallId+runId is already running (e.g. the LLM
    // replayed the call after a process restart): restart it to reattach the
    // per-stream hooks instead of dispatching a duplicate (ledger L5).
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
    logger?.debug?.(`Background task dispatch failed for ${toolName}, falling back to sync: ${bgError}`);
    return { status: 'sync' };
  }
}
