/**
 * Implementation of `Agent.streamUntilIdle`. Extracted from `agent.ts` to
 * keep that file focused on the public Agent surface. `Agent.streamUntilIdle`
 * is a thin delegate that forwards to `runStreamUntilIdle(this, ..., deps)`.
 *
 * High-level flow:
 * 1. Resolve memory / thread / resource scope (early-return to `agent.stream`
 *    if no memory backend exists — continuations require memory).
 * 2. Register this call as the active wrapper for `(threadId, resourceId)`,
 *    aborting any prior wrapper for the same scope (prevents duplicate
 *    bg-task event fan-out across concurrent calls).
 * 3. Run the initial turn via `agent.stream(...)` and pipe its `fullStream`
 *    into our own combined outer stream.
 * 4. Subscribe to `BackgroundTaskManager.stream(...)` for this scope; when a
 *    terminal bg event arrives, queue it and (when the outer is idle between
 *    turns) re-invoke the agent with a directive listing the just-completed
 *    tool-call IDs. Dedup set guards against at-least-once pubsub delivery.
 * 5. `maxIdleMs` only runs while the wrapper is between turns (not during an
 *    active inner stream) so slow first-tokens don't close the stream.
 */
import type { BackgroundTaskManager } from '../background-tasks/manager';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../request-context';
import type { MastraModelOutput } from '../stream/base/output';
import { deepMerge } from '../utils';
import type { Agent } from './agent';
import type { MessageListInput } from './message-list';

/**
 * Dependencies the extracted function needs access to that it can't reach
 * through the public `Agent` surface (e.g. private fields).
 */
export interface StreamUntilIdleDeps {
  /**
   * Map tracking the active `streamUntilIdle` wrapper per scope on the
   * calling Agent. The extracted function reads/writes this map directly so
   * a new call for the same scope can abort any prior still-open wrapper.
   * Lives as `#activeStreamUntilIdle` on the Agent instance.
   */
  activeStreams: Map<string, () => void>;
  /**
   * Optional background task manager resolved from Mastra. When absent,
   * `runStreamUntilIdle` falls through to a plain `agent.stream` call.
   */
  bgManager: BackgroundTaskManager | undefined;
}

interface ResolvedScope {
  threadId: string | undefined;
  resourceId: string | undefined;
  scopeKey: string | null;
}

const TERMINAL_BG_CHUNKS = new Set([
  'background-task-completed',
  'background-task-failed',
  'background-task-cancelled',
]);

/**
 * Resolve memory / thread / resource for this call, matching `#execute`
 * semantics (RequestContext-scoped keys override caller-supplied memory
 * args). Returns `null` when no memory backend is configured — caller
 * falls through to a plain stream in that case.
 */
async function resolveStreamUntilIdleScope(
  agent: Agent<any, any, any, any>,
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

  // Scope key = `threadId|resourceId`. Calls without either get null (no
  // active-stream coordination — no way to meaningfully identify "the same
  // conversation").
  const scopeKey = threadId || resourceId ? `${threadId ?? ''}|${resourceId ?? ''}` : null;

  return { threadId, resourceId, scopeKey };
}

/**
 * Build the ephemeral user-prompt text that tells the LLM which tool-call
 * IDs just completed. The directive stops the LLM from (a) re-processing
 * results already handled on a prior continuation and (b) mimicking the
 * prior assistant ack text ("I'm running it in the background") and
 * re-dispatching the same tool.
 */
function buildContinuationDirective(batch: Array<Record<string, unknown>>): string {
  const entries = batch
    .map(chunk => {
      const payload = (chunk as { payload?: Record<string, unknown> }).payload ?? {};
      return {
        toolCallId: payload.toolCallId as string | undefined,
        toolName: payload.toolName as string | undefined,
      };
    })
    .filter(e => !!e.toolCallId);

  const idList = entries.map(e => (e.toolName ? `${e.toolCallId} (${e.toolName})` : e.toolCallId)).join(', ');

  return (
    `Background task(s) you previously dispatched have completed. ` +
    `Process ONLY these tool-call IDs (their results are now in the conversation): ${idList}. ` +
    `IMPORTANT: Do NOT process any tool-call IDs that were not in the list, ` +
    `and do NOT call the same tool again — the result is already available. ` +
    `Use these result(s) to answer the user's original question.`
  );
}

/**
 * Wrap the continuation directive into a stream-options object suitable for
 * a recursive `agent.stream([], ...)` call. `context` messages are visible
 * to the LLM but NOT persisted to memory, so the directive doesn't pollute
 * future turns.
 */
function buildContinuationOpts(
  baseContinuationOpts: Record<string, any>,
  callerContext: any[] | undefined,
  batch: Array<Record<string, unknown>>,
): Record<string, any> {
  const directive = buildContinuationDirective(batch);
  return {
    ...baseContinuationOpts,
    context: [...(callerContext ?? []), { role: 'user' as const, content: directive }],
  };
}

/**
 * Register `closer` as the active wrapper for `scopeKey`, aborting any
 * prior registered closer first. No-op for null scopes.
 */
function acquireStreamSlot(activeStreams: Map<string, () => void>, scopeKey: string | null, closer: () => void): void {
  if (!scopeKey) return;
  const priorClose = activeStreams.get(scopeKey);
  priorClose?.();
  activeStreams.set(scopeKey, closer);
}

/**
 * Remove `closer` from the active streams map iff it's still the entry for
 * `scopeKey`. A later call that took over (and replaced the entry) will not
 * get its own entry deleted by a predecessor's delayed close.
 */
function releaseStreamSlot(activeStreams: Map<string, () => void>, scopeKey: string | null, closer: () => void): void {
  if (!scopeKey) return;
  if (activeStreams.get(scopeKey) === closer) {
    activeStreams.delete(scopeKey);
  }
}

/**
 * Run `agent.streamUntilIdle`. See the module doc above for the high-level
 * flow. Returns a `MastraModelOutput` whose `fullStream` spans the initial
 * turn PLUS any continuations triggered by background task completions.
 *
 * Aggregate properties (`text`, `toolCalls`, `toolResults`, `finishReason`,
 * `messageList`, `getFullOutput()`) still resolve against the first turn's
 * internal buffer. Consumers who need an aggregated view should read
 * `fullStream` and accumulate, or follow up with `agent.generate(...)`.
 */
export async function runStreamUntilIdle<OUTPUT>(
  agent: Agent<any, any, any, any>,
  messages: MessageListInput,
  streamOptions: (Record<string, any> & { maxIdleMs?: number }) | undefined,
  deps: StreamUntilIdleDeps,
): Promise<MastraModelOutput<OUTPUT>> {
  const { maxIdleMs: _maxIdleMs, ...restStreamOptions } = streamOptions ?? {};

  const defaultOptions = await agent.getDefaultOptions({
    requestContext: streamOptions?.requestContext,
  });
  const mergedOptions = deepMerge(
    defaultOptions as Record<string, unknown>,
    (restStreamOptions ?? {}) as Record<string, unknown>,
  ) as Record<string, any>;

  const scope = await resolveStreamUntilIdleScope(agent, mergedOptions);

  // Without a background task manager or memory, there's no continuation to
  // orchestrate — fall through to a plain stream with no wrapping.
  if (!deps.bgManager || !scope) {
    return agent.stream(messages, restStreamOptions as any) as Promise<MastraModelOutput<OUTPUT>>;
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

  // --- State (shared by the closures below; closures are used here instead
  //     of free functions because the state is tightly coupled and passing a
  //     ctx object would be verbose for every mutation) ---
  const runningTaskIds = new Set<string>();
  const pendingCompletions: Array<Record<string, unknown>> = [];
  // Per-call dedup of terminal bg events. Defense-in-depth for at-least-
  // once pubsub delivery (e.g. durable queue backings) — in the normal
  // in-process path each terminal event arrives once per subscriber, but
  // this guard also absorbs pathological cases where a completion is
  // redelivered while a continuation is still running.
  const processedCompletionIds = new Set<string>();
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
  // Pipe chunks from an inner stream into the outer, tracking any new
  // background-task-started chunks so we know what to wait for.
  const pipeInner = async (inner: ReadableStream<any>) => {
    const reader = inner.getReader();
    try {
      while (true) {
        if (outerAbort.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        // Active inner streaming — idle timer is cleared above via
        // isProcessing=true, but clear defensively on every chunk too.
        clearIdleTimer();
        try {
          outerController.enqueue(value);
        } catch {
          break;
        }
        if (value && typeof value === 'object' && (value as any).type === 'background-task-started') {
          const taskId = (value as any).payload?.taskId;
          if (taskId) runningTaskIds.add(taskId);
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  const processIfIdle = async () => {
    if (isProcessing || closed || pendingCompletions.length === 0) return;
    isProcessing = true;
    try {
      // Tool results are already in memory (onResult wrote them) — just
      // re-invoke the LLM so it can process whatever's new. Snapshot the
      // completions we're about to process so the continuation directive
      // names exactly those tool-call IDs (not any that arrive mid-turn).
      const batch = pendingCompletions.splice(0, pendingCompletions.length);

      // Mark taskIds as processed BEFORE kicking off the continuation.
      // The inner agent.stream can take a while; if a duplicate terminal
      // event for the same task arrives while it's running, the bg reader
      // filters it out rather than queueing another continuation.
      for (const chunk of batch) {
        const tid = (chunk as { payload?: { taskId?: string } }).payload?.taskId;
        if (tid) processedCompletionIds.add(tid);
      }
      const continuationOpts = buildContinuationOpts(baseContinuationOpts, restStreamOptions?.context as any[], batch);
      const inner = await (agent.stream as any)([], continuationOpts);
      await pipeInner(inner.fullStream);
    } catch (err) {
      try {
        outerController.error(err);
      } catch {
        // already closed
      }
    } finally {
      isProcessing = false;
      if (pendingCompletions.length > 0) {
        void processIfIdle();
      } else {
        // Between-turn transition — either close (nothing to wait for)
        // or arm the idle timer (still waiting on bg tasks).
        tryClose();
        updateIdleTimer();
      }
    }
  };

  // --- Setup ---
  acquireStreamSlot(deps.activeStreams, scopeKey, forceClose);

  // External abort fires → close the outer stream immediately, even if bg
  // tasks are still running (they'll continue in the background — their
  // results land in memory and will be picked up on the next turn).
  streamOptions?.abortSignal?.addEventListener('abort', forceClose);

  // --- Outer combined stream ---
  const combinedStream = new ReadableStream<any>({
    start(controller) {
      outerController = controller;
    },
    cancel() {
      closed = true;
      outerAbort.abort();
      clearIdleTimer();
    },
  });

  // --- Subscribe to background task events — drives continuations ---
  const bgStream = deps.bgManager.stream({
    agentId: agent.id,
    threadId,
    resourceId,
    abortSignal: outerAbort.signal,
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

        // Dedup guard: skip terminal events for tasks already handled on
        // a prior continuation (or about to be). Dropping both the
        // forward AND the state update so duplicates don't double-render
        // on the UI and don't queue redundant continuation turns.
        if (taskId && TERMINAL_BG_CHUNKS.has(chunk.type) && processedCompletionIds.has(taskId)) {
          continue;
        }

        // bg-task activity between turns refreshes the idle window.
        // If we're mid-inner-stream, updateIdleTimer clears (no-op).
        updateIdleTimer();

        // Forward bg chunks to the outer stream so consumers see task
        // lifecycle events inline with agent chunks (started, progress,
        // running, output, completed/failed/cancelled).
        try {
          outerController.enqueue(chunk);
        } catch {
          // outer closed
          break;
        }

        // Drive the state machine from the chunk type.
        if (!taskId) continue;
        if (chunk.type === 'background-task-running') {
          runningTaskIds.add(taskId);
        } else if (TERMINAL_BG_CHUNKS.has(chunk.type)) {
          runningTaskIds.delete(taskId);
          pendingCompletions.push(chunk);
          void processIfIdle();
        }
        // background-task-output / background-task-progress are just
        // informational — keep the idle timer fresh (done above) but don't
        // touch the running set or queue a continuation.
      }
    } catch {
      // bg stream ended
    } finally {
      bgReader.releaseLock();
    }
  })();

  // --- Initial turn ---
  // We need the MastraModelOutput object to return, so run stream() and
  // await the result. Its internal fullStream getter is what we consume
  // to feed the combined stream.
  isProcessing = true;
  clearIdleTimer();
  let first: MastraModelOutput<OUTPUT>;
  try {
    first = (await agent.stream(messages, initialStreamOpts as any)) as MastraModelOutput<OUTPUT>;
  } catch (err) {
    // The outer machinery — bg reader, idle timer, controller — was
    // started above. If the first stream() call rejects, nothing will
    // feed the outer controller but the background subscription would
    // keep running. Tear everything down before rethrowing so the caller
    // isn't left with orphaned resources.
    forceClose();
    throw err;
  }

  // Kick off piping in the background so we can return the wrapped result
  // immediately. The consumer can read from combinedStream while we're
  // still piping.
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
    if (pendingCompletions.length > 0) {
      void processIfIdle();
    } else {
      // Between-turn transition — either close (nothing to wait for)
      // or arm the idle timer (still waiting on bg tasks).
      tryClose();
      updateIdleTimer();
    }
  })();

  // Wrap the first turn's MastraModelOutput so `fullStream` returns our
  // combined stream (initial + continuations) while `text`, `finishReason`,
  // `toolCalls`, etc. still work — they resolve against the first turn's
  // internal event buffer, which gets populated as we consume its fullStream.
  return new Proxy(first, {
    get(target, prop) {
      if (prop === 'fullStream') return combinedStream;
      // Read target's own property with `this === target` so any internal
      // getters (e.g. `#getDelayedPromise`) don't recurse through the proxy
      // and hit our overridden fullStream.
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as MastraModelOutput<OUTPUT>;
}
