import type { AgentScopeEntry } from '../../agent/scopes';
/**
 * Shared helpers for the `streamUntilIdle` wrapper pattern used by both
 * the regular `Agent` and `DurableAgent`. Extracted to avoid duplicating
 * the state-machine, idle-timer, continuation-loop, and bg-task-event
 * plumbing across two files.
 *
 * The main entry point is `runIdleLoop`, a generic function that drives
 * the full idle-wrapper lifecycle. Callers provide:
 * - A `firstTurn` callback to run the initial stream/resume
 * - A `buildResult` callback to construct the caller-specific return value
 * - Optional `postPipeInner` hooks for durable-specific cleanup/abort tracking
 */
import { incomingAgentScopes, resolveAgentScopes } from '../../agent/scopes';
import type { BackgroundTaskManager } from '../../background-tasks/manager';
import type { MastraMemory } from '../../memory/memory';
import {
  MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_SCOPES_KEY,
  MASTRA_THREAD_ID_KEY,
  RequestContext,
} from '../../request-context';
import { deepMerge } from '../../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Upper bound on the startup task-adoption lookup; past it the wrapper tracks events only. */
const ADOPT_LOOKUP_TIMEOUT_MS = 5_000;

/** Inner-run chunks after which the run is parked, waiting to be resumed. */
const PARKING_CHUNKS = new Set(['tool-call-approval', 'tool-call-suspended']);

export const TERMINAL_BG_CHUNKS = new Set([
  'background-task-completed',
  'background-task-failed',
  'background-task-cancelled',
  // Suspended is non-terminal for the bg task itself (it can be resumed
  // later via `manager.resume`), but it IS terminal-for-this-iteration of
  // the streamUntilIdle wrapper: the agent should react to the suspend in
  // a follow-up turn so the user is told the task is parked. Without
  // this, the wrapper waits indefinitely for completed/failed/cancelled
  // and the stream times out.
  'background-task-suspended',
]);

// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------

export interface ResolvedScope {
  threadId: string | undefined;
  resourceId: string | undefined;
  scopeKey: string | null;
}

/**
 * Resolve memory / thread / resource for this call, matching `#execute`
 * semantics (RequestContext-scoped keys override caller-supplied memory
 * args). Returns `null` when no memory backend is configured — caller
 * falls through to a plain stream in that case.
 */
export async function resolveScope(
  agent: {
    getMemory: (opts?: any) => Promise<MastraMemory | undefined>;
    getScopes?: (opts?: any) => Promise<AgentScopeEntry[]>;
  },
  mergedOptions: Record<string, any>,
): Promise<ResolvedScope | null> {
  const requestContext = (mergedOptions?.requestContext as RequestContext | undefined) ?? new RequestContext();
  const memory = await agent.getMemory({ requestContext });
  if (!memory) return null;

  // With agent scopes, the run's thread/resource come from the same resolver stream() uses.
  const callScopes = mergedOptions?.scopes as AgentScopeEntry[] | undefined;
  const incoming = incomingAgentScopes({ requestContext, callScopes });
  const agentScopes = agent.getScopes ? await agent.getScopes({ requestContext, scopes: incoming }) : incoming;
  if (agentScopes.length || callScopes?.length || requestContext.has(MASTRA_SCOPES_KEY)) {
    const { threadId, resourceId } = resolveAgentScopes({
      requestContext,
      agentScopes,
      callScopes,
      memory: mergedOptions?.memory,
    });
    const scopeKey = threadId || resourceId ? `${threadId ?? ''}|${resourceId ?? ''}` : null;
    return { threadId, resourceId, scopeKey };
  }

  const threadIdFromContext = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;
  const resourceIdFromContext = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  const threadIdFromArgs =
    typeof mergedOptions?.memory?.thread === 'string'
      ? mergedOptions.memory.thread
      : (mergedOptions?.memory?.thread as { id?: string } | undefined)?.id;

  const threadId = threadIdFromContext ?? threadIdFromArgs;
  const resourceId = resourceIdFromContext ?? (mergedOptions?.memory?.resource as string | undefined);
  const scopeKey = threadId || resourceId ? `${threadId ?? ''}|${resourceId ?? ''}` : null;

  return { threadId, resourceId, scopeKey };
}

// ---------------------------------------------------------------------------
// Continuation directive
// ---------------------------------------------------------------------------

/**
 * Build the ephemeral system-context text that tells the LLM which tool-call
 * IDs just completed / failed / canceled. The directive stops the LLM from (a) re-processing
 * results already handled on a prior continuation and (b) mimicking the
 * prior assistant ack text ("I'm running it in the background") and
 * re-dispatching the same tool.
 */
export function buildContinuationDirective(batch: Array<Record<string, unknown>>): string {
  const entries = batch
    .map(chunk => {
      const payload = (chunk as { payload?: Record<string, unknown> }).payload ?? {};
      return {
        type: (chunk as { type?: string }).type,
        taskId: payload.taskId as string | undefined,
        toolCallId: payload.toolCallId as string | undefined,
        toolName: payload.toolName as string | undefined,
        isSuspended: !!payload.suspendedAt,
      };
    })
    .filter(e => !!e.toolCallId);

  // Suspend payloads are tool-controlled and may carry secrets, PII, or
  // large opaque blobs — never serialize them into the continuation
  // prompt. Just name the suspended tool-call IDs.
  const formatEntry = (e: (typeof entries)[number]) => {
    const tool = e.toolName ? ` (${e.toolName})` : '';
    const task = e.taskId ? `, background task ${e.taskId}` : ', background task';
    return `${e.toolCallId}${tool}${task}`;
  };

  const completedIdList = entries
    .filter(e => e.type === 'background-task-completed' && !e.isSuspended)
    .map(formatEntry)
    .join(', ');

  const failedIdList = entries
    .filter(e => e.type === 'background-task-failed' && !e.isSuspended)
    .map(formatEntry)
    .join(', ');

  const cancelledIdList = entries
    .filter(e => e.type === 'background-task-cancelled' && !e.isSuspended)
    .map(formatEntry)
    .join(', ');

  const suspendedIdList = entries
    .filter(e => e.isSuspended)
    .map(formatEntry)
    .join(', ');

  let directive = '';

  if (entries.length > 0) {
    directive +=
      ' IMPORTANT: These tool calls ran as background tasks. Their authoritative results may now look like ordinary tool results after reconciliation; do not reinterpret them as foreground calls.';
  }

  if (completedIdList) {
    directive +=
      ` IMPORTANT: The following tool-call IDs completed successfully: ${completedIdList}. ` +
      `Their results are now in the conversation. ` +
      `Do not call the same tool again — the result is already available. `;
  }

  if (failedIdList) {
    directive +=
      ` IMPORTANT: The following tool-call IDs failed: ${failedIdList}. ` +
      `Their failure information is now in the conversation. ` +
      `Do not retry these tools unless the user explicitly requests it. `;
  }

  if (cancelledIdList) {
    directive +=
      ` IMPORTANT: The following tool-call IDs were cancelled by the user before completion: ${cancelledIdList}. ` +
      `These tasks do not have results. ` +
      `Do not treat them as completed and do not call the same tool again unless the user explicitly requests it. `;
  }

  if (suspendedIdList) {
    directive +=
      ` IMPORTANT: The following tool-call IDs are suspended: ${suspendedIdList}. ` +
      `Do not attempt to resume them; let the user know they are waiting for explicit resume input.`;
  }

  return directive.trim();
}

/**
 * Wrap the continuation directive into a stream-options object suitable for
 * a recursive `agent.stream([], ...)` call. `context` messages are visible
 * to the LLM but NOT persisted to memory, so the directive doesn't pollute
 * future turns.
 */
export function buildContinuationOpts(
  baseContinuationOpts: Record<string, any>,
  callerContext: any[] | undefined,
  batch: Array<Record<string, unknown>>,
): Record<string, any> {
  const directive = buildContinuationDirective(batch);
  const toolCallIds = batch
    .map(chunk => (chunk as { payload?: { toolCallId?: unknown } }).payload?.toolCallId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  // Share the caller's context so tool/processor updates stay visible to it. IDs are merged with
  // any set by an overlapping continuation on the same context; releaseContinuationToolCallIds
  // removes only this continuation's IDs once it finishes.
  const requestContext = (baseContinuationOpts.requestContext as RequestContext | undefined) ?? new RequestContext();
  const existing = (requestContext.get(MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY) as string[] | undefined) ?? [];
  requestContext.set(MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY, [...new Set([...existing, ...toolCallIds])]);
  return {
    ...baseContinuationOpts,
    requestContext,
    continuationToolCallIds: toolCallIds,
    context: [...(callerContext ?? []), { role: 'system' as const, content: directive }],
  };
}

export function releaseContinuationToolCallIds(requestContext: RequestContext | undefined, toolCallIds: string[]) {
  if (!requestContext) return;
  const own = new Set(toolCallIds);
  const remaining = ((requestContext.get(MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY) as string[] | undefined) ?? []).filter(
    id => !own.has(id),
  );
  if (remaining.length) requestContext.set(MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY, remaining);
  else requestContext.delete(MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY);
}

// ---------------------------------------------------------------------------
// Active-stream slot management
// ---------------------------------------------------------------------------

const runStreamSlotKey = (runId: string) => `run:${runId}`;

/** Return the active untilIdle wrapper registered for a caller-visible run ID. */
export function getRunStreamSlot(activeStreams: Map<string, () => void>, runId: string): (() => void) | undefined {
  return activeStreams.get(runStreamSlotKey(runId));
}

/** Return the active scope wrapper when it still belongs to the expected caller-visible run. */
export function getScopeStreamSlot(
  activeStreams: Map<string, () => void>,
  scopeKey: string,
  expectedRunId?: string,
): (() => void) | undefined {
  const closer = activeStreams.get(scopeKey);
  if (expectedRunId === undefined || closer === getRunStreamSlot(activeStreams, expectedRunId)) return closer;
  return undefined;
}

/**
 * Why a wrapper is closed by a newer one: `replaced` when another stream takes its memory
 * scope, `sameRun` when another wrapper (e.g. a resume) takes over the same run.
 */
type StreamSlotCloseReason = 'replaced' | 'sameRun';

/** Register the active wrapper for a memory scope, aborting the prior wrapper for that scope. */
export function acquireStreamSlot(
  activeStreams: Map<string, (reason?: StreamSlotCloseReason) => void>,
  scopeKey: string | null,
  closer: (reason?: StreamSlotCloseReason) => void,
): void {
  if (!scopeKey) return;
  const priorClose = activeStreams.get(scopeKey);
  priorClose?.('replaced');
  activeStreams.set(scopeKey, closer);
}

/** Register the active wrapper under its caller-visible run ID, replacing an older wrapper for that ID. */
export function acquireRunStreamSlot(
  activeStreams: Map<string, (reason?: StreamSlotCloseReason) => void>,
  runId: string | undefined,
  closer: (reason?: StreamSlotCloseReason) => void,
): void {
  if (!runId) return;
  const key = runStreamSlotKey(runId);
  const priorClose = activeStreams.get(key);
  priorClose?.('sameRun');
  activeStreams.set(key, closer);
}

/**
 * Remove `closer` from its scope and caller-visible run slots iff it is still
 * the registered wrapper. A later wrapper that took over either slot is left intact.
 */
export function releaseStreamSlot(
  activeStreams: Map<string, () => void>,
  scopeKey: string | null,
  runId: string | undefined,
  closer: () => void,
): void {
  if (scopeKey && activeStreams.get(scopeKey) === closer) {
    activeStreams.delete(scopeKey);
  }
  if (runId) {
    const key = runStreamSlotKey(runId);
    if (activeStreams.get(key) === closer) activeStreams.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Idle-loop state machine
// ---------------------------------------------------------------------------

export interface IdleLoopDeps {
  activeStreams: Map<string, () => void>;
  bgManager: BackgroundTaskManager | undefined;
}

/**
 * Called after each inner stream result (first turn + continuations).
 * Durable agents use this to track cleanup/abort handles.
 */
export interface PostPipeHooks {
  /** Durable readers own their subscription, not the underlying execution. */
  detachOnCancel?: boolean;
  /** Called with each inner result after `firstTurn` or continuation. */
  onInnerResult?: (inner: any) => void;
  /** Abort the currently active inner stream before the wrapper closes. */
  onAbortActive?: () => void;
  /** Extra teardown to run inside `forceClose`. */
  onForceClose?: () => void;
}

/**
 * Everything the `buildResult` callback needs to construct the
 * caller-specific return type.
 */
export interface IdleLoopContext {
  combinedStream: ReadableStream<any>;
  forceClose: () => void;
  abort: () => void;
  threadId: string | undefined;
  resourceId: string | undefined;
}

/**
 * Generic idle-loop wrapper. Drives the full lifecycle:
 * 1. Merge options + resolve scope (early-return if no bgManager / no memory)
 * 2. Acquire stream slot
 * 3. Run first turn via `firstTurn(opts)`
 * 4. Subscribe to `bgManager.stream()` for bg-task events
 * 5. On terminal bg events, queue and process continuations via `streamForContinuation`
 * 6. Idle timer fires `forceClose` if nothing happens for `maxIdleMs`
 *
 * @param agent    Must expose `.id`, `.getDefaultOptions(...)`, `.getMemory(...)`.
 * @param streamOptions  Caller-supplied stream options (may include `maxIdleMs`).
 * @param deps     `{ activeStreams, bgManager }`.
 * @param firstTurn  Callback for the initial turn. Returns the first result.
 * @param streamForContinuation  Callback to create a continuation stream.
 *    Returns an inner result (any shape); the `.fullStream` field is piped.
 * @param buildResult  Callback to construct the final return value from the
 *    first-turn result + idle-loop context.
 * @param hooks    Optional durable-specific hooks for cleanup/abort tracking.
 */
export async function runIdleLoop<
  TAgent extends {
    id: string;
    getDefaultOptions: (opts?: any) => any | Promise<any>;
    getMemory: (opts?: any) => Promise<MastraMemory | undefined>;
    abortRunStream?: (runId: string) => boolean;
  },
  TFirstResult extends { fullStream: any; runId?: string },
  TReturn,
>(
  agent: TAgent,
  streamOptions: (Record<string, any> & { maxIdleMs?: number }) | undefined,
  deps: IdleLoopDeps,
  firstTurn: (opts: Record<string, any>) => Promise<TFirstResult>,
  streamForContinuation: (opts: Record<string, any>) => Promise<{ fullStream: ReadableStream<any>; runId?: string }>,
  buildResult: (first: TFirstResult, ctx: IdleLoopContext) => TReturn,
  hooks?: PostPipeHooks,
): Promise<TReturn> {
  const { maxIdleMs: _maxIdleMs, ...restStreamOptions } = streamOptions ?? {};
  // Inner calls re-merge defaultOptions; force false so an inherited default cannot re-enter the wrapper.
  (restStreamOptions as Record<string, any>).untilIdle = false;

  const defaultOptions = await agent.getDefaultOptions({
    requestContext: streamOptions?.requestContext,
  });
  const mergedOptions = deepMerge(
    defaultOptions as Record<string, unknown>,
    (restStreamOptions ?? {}) as Record<string, unknown>,
  ) as Record<string, any>;

  const scope = await resolveScope(agent, mergedOptions);

  // Without a background task manager or memory, there's no continuation to
  // orchestrate — fall through to the plain underlying call with no wrapping.
  if (!deps.bgManager || !scope) {
    return buildResult(await firstTurn(restStreamOptions as Record<string, any>), null!);
  }

  const { threadId, resourceId, scopeKey } = scope;
  const maxIdleMs = _maxIdleMs ?? deps.bgManager.config.untilIdleMaxIdleMs ?? 5 * 60_000;

  // Continuation calls reuse the memory thread but drop segment-scoped options.
  // Omitting runId lets durable agents start a fresh stream segment instead of
  // replaying cached history from the caller's initial run.
  const { runId: _runId, ...continuationStreamOptions } = restStreamOptions as Record<string, any>;
  const baseContinuationOpts = {
    ...continuationStreamOptions,
    onFinish: undefined,
    _skipBgTaskWait: true,
  } as Record<string, any>;

  const initialAbort = new AbortController();
  const callerAbortSignal = restStreamOptions.abortSignal as AbortSignal | undefined;
  const initialStreamOpts = {
    ...(restStreamOptions ?? {}),
    abortSignal: callerAbortSignal ? AbortSignal.any([callerAbortSignal, initialAbort.signal]) : initialAbort.signal,
    _skipBgTaskWait: true,
  } as Record<string, any>;

  // --- State ---
  const runningTaskIds = new Set<string>();
  const pendingCompletions: Array<Record<string, unknown>> = [];
  const processedTerminalKeys = new Set<string>();
  /** Tasks whose terminal bg chunk this wrapper already saw — the startup
   * adoption lookup must not re-add them from a stale storage snapshot. */
  const settledTaskIds = new Set<string>();
  let isProcessing = false;
  let closed = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let outerController!: ReadableStreamDefaultController<any>;
  let wrapperRunId = restStreamOptions.runId as string | undefined;
  let activeInnerRunId: string | undefined;
  let continuationAbort: AbortController | undefined;
  let aborting = false;
  let detached = false;
  let observerDetached = false;
  // Set once the active inner run parks on a tool approval or a tool
  // suspend(). A parked run is waiting for resumeStreamUntilIdle(), so a reader
  // that stops reading (break / request disconnect) must only detach;
  // aborting here would discard the run the caller is about to resume.
  let parked = false;
  let innerReader: ReadableStreamDefaultReader<any> | undefined;
  const outerAbort = new AbortController();
  const continuationRunIds = new Set<string>();
  const releaseWrapperSlots = () => {
    releaseStreamSlot(deps.activeStreams, scopeKey, wrapperRunId, abortWrapper);
    for (const runId of continuationRunIds) {
      releaseStreamSlot(deps.activeStreams, null, runId, abortWrapper);
    }
    continuationRunIds.clear();
  };

  // --- Close / idle timer ---
  const forceClose = (opts?: { keepInnerRuns?: boolean }) => {
    if (closed) return;
    detached = opts?.keepInnerRuns === true;
    closed = true;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
    releaseWrapperSlots();
    outerAbort.abort();
    try {
      outerController.close();
    } catch {
      // already closed
    }
    if (opts?.keepInnerRuns) {
      // Cancelling the inner reader only unsubscribes this wrapper; the
      // parked run and its registry entry stay in place for the resume.
      void innerReader?.cancel().catch(() => {});
    } else {
      hooks?.onForceClose?.();
    }
  };

  const abortWrapper = (reason?: StreamSlotCloseReason) => {
    if ((closed && !detached) || aborting) return;
    // A wrapper taking over this run resumes it, so a parked run must stay resumable.
    if (parked && (reason === 'sameRun' || (reason === 'replaced' && hooks?.detachOnCancel))) {
      forceClose({ keepInnerRuns: true });
      return;
    }
    aborting = true;
    // External engines route abortRunStream back through this registry; release before forwarding.
    releaseWrapperSlots();
    initialAbort.abort();
    continuationAbort?.abort();
    hooks?.onAbortActive?.();
    if (activeInnerRunId) agent.abortRunStream?.(activeInnerRunId);
    // Let durable execution unwind its abort before cleaning up run state.
    forceClose(hooks?.detachOnCancel ? { keepInnerRuns: true } : undefined);
  };

  const detachOrAbort = () => (parked ? forceClose({ keepInnerRuns: true }) : abortWrapper());

  const tryClose = () => {
    if (closed) return;
    if (isProcessing) return;
    if (runningTaskIds.size > 0) return;
    if (pendingCompletions.length > 0) return;
    // Detached observers may reattach after completion; retain the inner run's replay cache.
    forceClose(observerDetached ? { keepInnerRuns: true } : undefined);
  };

  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };

  // The idle timer exists to close the outer stream when we're *between*
  // turns and no bg task has reported progress for `maxIdleMs`. It must
  // NOT fire during an active inner LLM stream (slow first token / long
  // gaps between deltas are not "idle"), and it must NOT fire when there
  // is nothing to wait for (tryClose handles that terminal case).
  const updateIdleTimer = () => {
    if (closed) return;
    clearIdleTimer();
    if (isProcessing) return;
    if (runningTaskIds.size === 0) return;
    idleTimer = setTimeout(() => forceClose(), maxIdleMs);
  };

  // --- Stream plumbing ---
  const pipeInner = async (inner: ReadableStream<any>) => {
    const reader = inner.getReader();
    innerReader = reader;
    try {
      while (true) {
        if (outerAbort.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        clearIdleTimer();
        if (value && typeof value === 'object' && PARKING_CHUNKS.has((value as any).type)) {
          parked = true;
        }
        if (!observerDetached) {
          try {
            outerController.enqueue(value);
          } catch {
            break;
          }
        }
        if (value && typeof value === 'object' && (value as any).type === 'background-task-started') {
          const taskId = (value as any).payload?.taskId;
          if (taskId) {
            runningTaskIds.add(taskId);
          }
        }
      }
    } finally {
      if (innerReader === reader) innerReader = undefined;
      reader.releaseLock();
    }
  };

  const processIfIdle = async () => {
    if (isProcessing || closed || runningTaskIds.size > 0 || pendingCompletions.length === 0) return;
    isProcessing = true;
    let continuationContext: RequestContext | undefined;
    let continuationToolCallIds: string[] = [];
    try {
      const batch = pendingCompletions.splice(0, pendingCompletions.length);
      for (const chunk of batch) {
        const tid = (chunk as { payload?: { taskId?: string } }).payload?.taskId;
        const ctype = (chunk as { type?: string }).type;
        if (tid && ctype) processedTerminalKeys.add(`${tid}:${ctype}`);
      }
      const continuationOpts = buildContinuationOpts(baseContinuationOpts, restStreamOptions?.context as any[], batch);
      continuationContext = continuationOpts.requestContext;
      continuationToolCallIds = continuationOpts.continuationToolCallIds;
      delete continuationOpts.continuationToolCallIds;
      const segmentAbort = new AbortController();
      continuationAbort = segmentAbort;
      activeInnerRunId = undefined;
      parked = false;
      const existingAbortSignal = continuationOpts.abortSignal as AbortSignal | undefined;
      continuationOpts.abortSignal = existingAbortSignal
        ? AbortSignal.any([existingAbortSignal, segmentAbort.signal])
        : segmentAbort.signal;
      const inner = await streamForContinuation(continuationOpts);
      activeInnerRunId = inner.runId;
      hooks?.onInnerResult?.(inner);
      if (closed) {
        if (detached && !aborting) {
          await inner.fullStream.cancel();
        } else {
          hooks?.onAbortActive?.();
          if (activeInnerRunId) agent.abortRunStream?.(activeInnerRunId);
        }
        return;
      }
      if (
        hooks?.detachOnCancel &&
        activeInnerRunId &&
        getRunStreamSlot(deps.activeStreams, activeInnerRunId) !== abortWrapper
      ) {
        acquireRunStreamSlot(deps.activeStreams, activeInnerRunId, abortWrapper);
        continuationRunIds.add(activeInnerRunId);
      }
      await pipeInner(inner.fullStream);
      if (continuationAbort === segmentAbort) continuationAbort = undefined;
    } catch (err) {
      try {
        outerController.error(err);
      } catch {
        // already closed
      }
      forceClose();
    } finally {
      releaseContinuationToolCallIds(continuationContext, continuationToolCallIds);
      isProcessing = false;
      if (runningTaskIds.size === 0 && pendingCompletions.length > 0) {
        void processIfIdle();
      } else {
        tryClose();
        updateIdleTimer();
      }
    }
  };

  // --- Setup ---
  // Take the run slot first: a resume detaches its parked predecessor, which frees the scope slot too.
  acquireRunStreamSlot(deps.activeStreams, wrapperRunId, abortWrapper);
  acquireStreamSlot(deps.activeStreams, scopeKey, abortWrapper);

  streamOptions?.abortSignal?.addEventListener('abort', detachOrAbort, { once: true });

  const combinedStream = new ReadableStream<any>({
    start(controller) {
      outerController = controller;
    },
    cancel() {
      if (hooks?.detachOnCancel && !parked) {
        // Keep draining segments and scheduling background continuations without an observer.
        observerDetached = true;
      } else detachOrAbort();
    },
  });

  // --- Subscribe to background task events ---
  const bgStream = deps.bgManager.stream({
    agentId: agent.id,
    threadId,
    resourceId,
    abortSignal: outerAbort.signal,
    includeExisting: false,
  });
  const bgReader = bgStream.getReader();
  void (async () => {
    try {
      while (true) {
        if (outerAbort.signal.aborted) break;
        const { done, value } = await bgReader.read();
        if (done) break;
        const chunk = value as { type?: string; payload?: Record<string, unknown> };
        if (!chunk || typeof chunk !== 'object' || typeof chunk.type !== 'string') continue;

        const taskId = (chunk.payload as { taskId?: string } | undefined)?.taskId;

        // An unscoped wrapper (no thread or resource id) subscribes with
        // wildcard filters, so it would receive every resource's task events
        // for this agent — terminal payloads include the task result. Same
        // semantics as the adoption gate below: unscoped streams own nothing
        // cross-resource, so only deliver events for tasks this wrapper
        // observed itself.
        if (!threadId && !resourceId && taskId && !runningTaskIds.has(taskId) && !settledTaskIds.has(taskId)) {
          continue;
        }

        const terminalKey = taskId && TERMINAL_BG_CHUNKS.has(chunk.type) ? `${taskId}:${chunk.type}` : undefined;
        if (terminalKey && processedTerminalKeys.has(terminalKey)) {
          continue;
        }

        updateIdleTimer();

        if (!observerDetached) {
          try {
            outerController.enqueue(chunk);
          } catch {
            break;
          }
        }

        if (!taskId) continue;
        if (chunk.type === 'background-task-running' || chunk.type === 'background-task-resumed') {
          runningTaskIds.add(taskId);
        } else if (TERMINAL_BG_CHUNKS.has(chunk.type)) {
          settledTaskIds.add(taskId);
          runningTaskIds.delete(taskId);
          pendingCompletions.push(chunk);
          if (runningTaskIds.size === 0) void processIfIdle();
        }
      }
    } catch {
      // bg stream ended
    } finally {
      bgReader.releaseLock();
    }
  })();

  // --- Initial turn ---
  isProcessing = true;
  clearIdleTimer();

  // Adopt tasks started by a prior wrapper on this scope (#26841): a new
  // untilIdle stream aborts the previous wrapper via acquireStreamSlot, and
  // this wrapper's bg subscription (`includeExisting: false`) never saw their
  // 'running' events. Without this lookup the wrapper closes after its first
  // turn and those tasks' completions wake nobody. Runs concurrently with the
  // first turn (isProcessing blocks continuations and tryClose until both
  // settle); `settledTaskIds` keeps a task whose terminal chunk already
  // arrived from being re-added off a stale storage snapshot.
  const bgManager = deps.bgManager;
  // The storage contract defines no timeout for listTasks; a hung adapter
  // must not hold isProcessing forever (blocking continuations and the idle
  // timer). After the bound, continue with event-only tracking and ignore a
  // late lookup result.
  let adoptionAbandoned = false;
  const adoptPriorTasks = (async () => {
    try {
      // Adoption requires an authorized scope. Task filters drop undefined
      // keys, so without a thread or resource id the lookup would return
      // EVERY running/pending task for the agent — adopting them would let
      // another resource's task completion drive a continuation on this
      // stream and disclose its result. An unscoped stream therefore adopts
      // nothing: it only tracks tasks whose events it observes itself.
      if (!threadId && !resourceId) return;
      const { tasks } = await bgManager.listTasks({
        agentId: agent.id,
        threadId,
        resourceId,
        status: ['running', 'pending'],
      });
      if (adoptionAbandoned) return;
      for (const task of tasks) {
        if (!settledTaskIds.has(task.id)) runningTaskIds.add(task.id);
      }
    } catch {
      // Best-effort: on a failed lookup the wrapper behaves as before the
      // adoption pass (tracks only tasks whose events it sees itself).
    }
  })();

  let first: TFirstResult;
  try {
    first = await firstTurn(initialStreamOpts);
  } catch (err) {
    forceClose();
    throw err;
  }
  activeInnerRunId = first.runId;
  if (!wrapperRunId && first.runId) {
    wrapperRunId = first.runId;
    acquireRunStreamSlot(deps.activeStreams, wrapperRunId, abortWrapper);
  }
  hooks?.onInnerResult?.(first);

  void (async () => {
    try {
      await pipeInner(first.fullStream as ReadableStream<any>);
    } catch (err) {
      try {
        outerController.error(err);
      } catch {
        // already closed
      }
    }
    // The adoption lookup must land before the first idle evaluation, or
    // tryClose below could close the wrapper while an adopted task still
    // runs — but the wait is bounded so a hung storage adapter cannot block
    // the wrapper forever.
    await Promise.race([
      adoptPriorTasks,
      new Promise<void>(resolve => {
        const timer = setTimeout(() => {
          adoptionAbandoned = true;
          resolve();
        }, ADOPT_LOOKUP_TIMEOUT_MS);
        (timer as { unref?: () => void }).unref?.();
        void adoptPriorTasks.finally(() => clearTimeout(timer));
      }),
    ]);
    isProcessing = false;
    if (runningTaskIds.size === 0 && pendingCompletions.length > 0) {
      void processIfIdle();
    } else {
      tryClose();
      updateIdleTimer();
    }
  })();

  return buildResult(first, {
    combinedStream,
    forceClose: () => forceClose(),
    abort: () => abortWrapper(),
    threadId,
    resourceId,
  });
}
