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
import type { BackgroundTaskManager } from '../../background-tasks/manager';
import type { MastraMemory } from '../../memory/memory';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../request-context';
import { deepMerge } from '../../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
  agent: { getMemory: (opts?: any) => Promise<MastraMemory | undefined> },
  mergedOptions: Record<string, any>,
): Promise<ResolvedScope | null> {
  const requestContext = (mergedOptions?.requestContext as RequestContext | undefined) ?? new RequestContext();
  const memory = await agent.getMemory({ requestContext });
  if (!memory) return null;

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
        toolCallId: payload.toolCallId as string | undefined,
        toolName: payload.toolName as string | undefined,
        isSuspended: !!payload.suspendedAt,
      };
    })
    .filter(e => !!e.toolCallId);

  // Suspend payloads are tool-controlled and may carry secrets, PII, or
  // large opaque blobs — never serialize them into the continuation
  // prompt. Just name the suspended tool-call IDs.
  const formatEntry = (e: (typeof entries)[number]) => (e.toolName ? `${e.toolCallId} (${e.toolName})` : e.toolCallId!);

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
  return {
    ...baseContinuationOpts,
    context: [...(callerContext ?? []), { role: 'system' as const, content: directive }],
  };
}

// ---------------------------------------------------------------------------
// Active-stream slot management
// ---------------------------------------------------------------------------

/**
 * Register `closer` as the active wrapper for `scopeKey`, aborting any
 * prior registered closer first. No-op for null scopes.
 */
export function acquireStreamSlot(
  activeStreams: Map<string, () => void>,
  scopeKey: string | null,
  closer: () => void,
): void {
  if (!scopeKey) return;
  const priorClose = activeStreams.get(scopeKey);
  priorClose?.();
  activeStreams.set(scopeKey, closer);
}

/**
 * Remove `closer` from the active streams map iff it's still the entry for
 * `scopeKey`. A later call that took over (and replaced the entry) will not
 * get accidentally unregistered.
 */
export function releaseStreamSlot(
  activeStreams: Map<string, () => void>,
  scopeKey: string | null,
  closer: () => void,
): void {
  if (!scopeKey) return;
  if (activeStreams.get(scopeKey) === closer) {
    activeStreams.delete(scopeKey);
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
  /** Called with each inner result after `firstTurn` or continuation. */
  onInnerResult?: (inner: any) => void;
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
  },
  TFirstResult extends { fullStream: any },
  TReturn,
>(
  agent: TAgent,
  streamOptions: (Record<string, any> & { maxIdleMs?: number }) | undefined,
  deps: IdleLoopDeps,
  firstTurn: (opts: Record<string, any>) => Promise<TFirstResult>,
  streamForContinuation: (opts: Record<string, any>) => Promise<{ fullStream: ReadableStream<any> }>,
  buildResult: (first: TFirstResult, ctx: IdleLoopContext) => TReturn,
  hooks?: PostPipeHooks,
): Promise<TReturn> {
  const { maxIdleMs: _maxIdleMs, ...restStreamOptions } = streamOptions ?? {};

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
  const maxIdleMs = _maxIdleMs ?? 5 * 60_000;

  // Continuation calls reuse the memory thread but drop one-shot hooks.
  // `_skipBgTaskWait` prevents the inner loop from redundantly waiting for
  // running bg tasks — this outer method already handles that.
  const baseContinuationOpts = {
    ...(restStreamOptions ?? {}),
    onFinish: undefined,
    _skipBgTaskWait: true,
  } as Record<string, any>;

  const initialStreamOpts = {
    ...(restStreamOptions ?? {}),
    _skipBgTaskWait: true,
  } as Record<string, any>;

  // --- State ---
  const runningTaskIds = new Set<string>();
  const pendingCompletions: Array<Record<string, unknown>> = [];
  const processedTerminalKeys = new Set<string>();
  let isProcessing = false;
  let closed = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let outerController!: ReadableStreamDefaultController<any>;
  const outerAbort = new AbortController();

  // --- Close / idle timer ---
  const forceClose = () => {
    if (closed) return;
    closed = true;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
    outerAbort.abort();
    try {
      outerController.close();
    } catch {
      // already closed
    }
    hooks?.onForceClose?.();
    releaseStreamSlot(deps.activeStreams, scopeKey, forceClose);
  };

  const tryClose = () => {
    if (closed) return;
    if (isProcessing) return;
    if (runningTaskIds.size > 0) return;
    if (pendingCompletions.length > 0) return;
    forceClose();
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
    if (pendingCompletions.length > 0) return;
    idleTimer = setTimeout(forceClose, maxIdleMs);
  };

  // --- Stream plumbing ---
  const pipeInner = async (inner: ReadableStream<any>) => {
    const reader = inner.getReader();
    try {
      while (true) {
        if (outerAbort.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        clearIdleTimer();
        try {
          outerController.enqueue(value);
        } catch {
          break;
        }
        if (value && typeof value === 'object' && (value as any).type === 'background-task-started') {
          const taskId = (value as any).payload?.taskId;
          if (taskId) {
            runningTaskIds.add(taskId);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  const processIfIdle = async () => {
    if (isProcessing || closed || runningTaskIds.size > 0 || pendingCompletions.length === 0) return;
    isProcessing = true;
    try {
      const batch = pendingCompletions.splice(0, pendingCompletions.length);
      for (const chunk of batch) {
        const tid = (chunk as { payload?: { taskId?: string } }).payload?.taskId;
        const ctype = (chunk as { type?: string }).type;
        if (tid && ctype) processedTerminalKeys.add(`${tid}:${ctype}`);
      }
      const continuationOpts = buildContinuationOpts(baseContinuationOpts, restStreamOptions?.context as any[], batch);
      const inner = await streamForContinuation(continuationOpts);
      hooks?.onInnerResult?.(inner);
      await pipeInner(inner.fullStream);
    } catch (err) {
      try {
        outerController.error(err);
      } catch {
        // already closed
      }
      forceClose();
      return;
    } finally {
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
  acquireStreamSlot(deps.activeStreams, scopeKey, forceClose);

  streamOptions?.abortSignal?.addEventListener('abort', forceClose);

  const combinedStream = new ReadableStream<any>({
    start(controller) {
      outerController = controller;
    },
    cancel() {
      forceClose();
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

        const terminalKey = taskId && TERMINAL_BG_CHUNKS.has(chunk.type) ? `${taskId}:${chunk.type}` : undefined;
        if (terminalKey && processedTerminalKeys.has(terminalKey)) {
          continue;
        }

        updateIdleTimer();

        try {
          outerController.enqueue(chunk);
        } catch {
          break;
        }

        if (!taskId) continue;
        if (chunk.type === 'background-task-running' || chunk.type === 'background-task-resumed') {
          runningTaskIds.add(taskId);
        } else if (TERMINAL_BG_CHUNKS.has(chunk.type)) {
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
  let first: TFirstResult;
  try {
    first = await firstTurn(initialStreamOpts);
  } catch (err) {
    forceClose();
    throw err;
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
    isProcessing = false;
    if (runningTaskIds.size === 0 && pendingCompletions.length > 0) {
      void processIfIdle();
    } else {
      tryClose();
      updateIdleTimer();
    }
  })();

  return buildResult(first, { combinedStream, forceClose, threadId, resourceId });
}
