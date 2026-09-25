import { isToolBackgroundEligible } from '../../../background-tasks/resolve-config';
import type { AgentBackgroundConfig, ToolBackgroundConfig } from '../../../background-tasks/types';

type EagerToolResult = unknown;

/**
 * Marker placed on the workflow execution context when `toolCallStep` is invoked
 * eagerly from the LLM execution step. Its presence tells the step not to look
 * for (and await) an eager execution of itself.
 */
export const EAGER_TOOL_EXECUTION_MARKER = Symbol('eager-tool-execution');

/**
 * Carries the coordinator's per-execution abort signal into `toolCallStep`. A dedicated
 * key rather than the step's own `abortSignal` argument, so no other caller's behaviour
 * changes: the step combines this with the run signal only when it is present.
 */
export const EAGER_TOOL_ABORT_SIGNAL = Symbol('eager-tool-abort-signal');

/**
 * Carries a per-dispatch bailout record into `toolCallStep`, so a call that turns out to
 * need suspension can mark itself unusable *before* throwing.
 *
 * The throw alone is not fail-safe: it unwinds through the tool's own body, and a tool
 * that wraps its work in try/catch swallows it and returns normally. The step would then
 * resolve an ordinary-looking envelope and the foreach would adopt a result for a call
 * that asked to suspend. The dispatcher re-reads this record after the step settles and
 * converts any marked settlement back into a rejection.
 *
 * One record per dispatch, so a later attempt reusing the same toolCallId cannot observe
 * a previous attempt's bailout.
 */
export const EAGER_TOOL_BAILOUT = Symbol('eager-tool-bailout');

/** Set by `toolCallStep` when an eagerly dispatched call bails out. */
/**
 * What an eagerly dispatched tool asked for when it called `suspend()` at runtime.
 *
 * The eager attempt is abandoned before any suspension side effect happens, so this
 * intent is what the adopting foreach iteration replays: it raises the real suspension
 * from the owning iteration instead of re-running the tool body from the top.
 *
 * The options are an explicit pick rather than the whole `SuspendOptions`, which is
 * `{ resumeLabel?: string | string[] } & Record<string, any>` — carrying it verbatim
 * would make the carrier unbounded and let a caller smuggle arbitrary keys across.
 */
export type EagerSuspensionIntent = {
  suspendPayload: unknown;
  options: {
    resumeLabel?: string | string[];
    resumeSchema?: unknown;
    runId?: string;
    requireToolApproval?: boolean | { toolName?: string; args?: unknown };
  };
};

export type EagerToolBailout = {
  reason?: string;
  /**
   * Set when the bailout was caused by a runtime `suspend()` call, carrying what the
   * tool asked to suspend with. Recorded before the throw for the same reason `reason`
   * is: a tool that catches the throw would otherwise return normally and lose it.
   */
  suspension?: EagerSuspensionIntent;
  /**
   * Set once the eager attempt has run the tool's `onInputAvailable`. The hook is
   * announced before `execute`, so a bailout that happens inside the tool body has
   * already fired it; the foreach re-runs the same `execute` function and would
   * otherwise announce the same `toolCallId` a second time.
   */
  inputAvailableCalled?: boolean;
};

/** Brands errors whose eager attempt produced no adoptable result. */
const EAGER_NOT_EXECUTED = Symbol('eager-tool-not-executed');

/** Brands a bailout whose eager attempt already announced `onInputAvailable`. */
const EAGER_INPUT_ANNOUNCED = Symbol('eager-tool-input-announced');

/** Carries a runtime suspension's intent out of the attempt that was abandoned for it. */
const EAGER_SUSPENSION_INTENT = Symbol('eager-tool-suspension-intent');

type RunningExecution = {
  controller: AbortController;
  releasePermit: () => void;
};

/**
 * A tool call that ran to completion eagerly but was never adopted, because the model
 * attempt it belonged to was thrown away. The side effect already happened, so the
 * caller commits this into the conversation rather than letting the replacement
 * attempt run the same tool a second time.
 */
export type CompletedEagerWork = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  /** The tool's own output, unwrapped from the step's envelope. Absent when it threw. */
  result?: unknown;
  /** What the tool threw. A failed call is still a call that ran. */
  error?: unknown;
  /**
   * The tool started, then observed the run's abort and stopped without an outcome.
   * Kept so the aborted run records the call as incomplete, as the default pipeline does.
   */
  incomplete?: true;
  /**
   * The order the model emitted this call in. Executions settle in whatever order they
   * finish, and history is written in model-call order everywhere else, so the caller
   * sorts by this before committing anything.
   */
  sequence: number;
};

type QueuedExecution = {
  toolCallId: string;
  run: () => void;
  cancel: () => void;
};

/**
 * Starts eligible server-side tool executions while the model is still streaming,
 * and hands the in-flight promise to `toolCallStep` so the existing foreach remains
 * the owner of result ordering and history.
 *
 * The permit limit is read through `getConcurrency` rather than copied, because
 * `map-tool-calls` recomputes the effective limit per step (an approval- or
 * suspend-capable tool entering the step forces the foreach down to 1). Reading it
 * late keeps one source of truth for the limit.
 */
export class EagerToolExecutionCoordinator {
  readonly #executions = new Map<string, Promise<EagerToolResult>>();
  readonly #queued: QueuedExecution[] = [];
  readonly #controllers = new Map<string, RunningExecution>();
  /**
   * Results of executions that finished but have not been adopted yet. Held so that an
   * attempt thrown away mid-stream can still surrender the work it already did, instead
   * of the side effect happening twice.
   */
  readonly #completed = new Map<string, CompletedEagerWork>();
  /**
   * Calls whose eager attempt already ran the body up to a runtime `suspend()`. Retrying
   * the model would re-emit the call and run that pre-suspend work a second time, so an
   * attempt holding one of these must not be retried.
   */
  readonly #suspended = new Set<string>();
  /** Executions that have started and not yet settled, so a discard can wait them out. */
  readonly #inFlight = new Set<Promise<unknown>>();
  #running = 0;
  #dispatchSequence = 0;
  #stopped = false;
  #stoppedPermanently = false;

  constructor(private readonly getConcurrency: () => number) {}

  /**
   * Hand over the in-flight eager execution for a tool call, if one was started,
   * and forget it. Taking rather than reading keeps adoption exactly-once: a later
   * iteration that reuses the same `toolCallId` executes again instead of adopting
   * the previous iteration's settled result.
   */
  take(toolCallId: string) {
    const execution = this.#executions.get(toolCallId);
    this.#executions.delete(toolCallId);
    this.#completed.delete(toolCallId);
    this.#suspended.delete(toolCallId);
    return execution;
  }

  /**
   * Start an eager execution keyed by canonical `toolCallId`. Returns false when the
   * coordinator is stopped or the id is already in flight, so a replayed or duplicate
   * id within the same step can never execute twice.
   */
  start(
    toolCallId: string,
    execute: (abortSignal: AbortSignal) => Promise<EagerToolResult>,
    call?: { toolName: string; args: unknown },
  ) {
    if (this.#stopped || this.#executions.has(toolCallId)) return false;

    // Dispatch happens on complete tool-call chunks as the model emits them, so the order
    // calls arrive here is the model-call order the rest of the pipeline preserves.
    const sequence = this.#dispatchSequence++;

    // Its own controller, so work started for an attempt the pipeline later discards can
    // be cancelled without touching the run's signal.
    const controller = new AbortController();

    // Held once, released once — by whichever comes first, the execution settling or the
    // execution being cancelled. A tool that ignores its abort signal must not keep a
    // permit that the surviving attempt's calls are waiting on.
    let holdsPermit = false;
    const releasePermit = () => {
      if (!holdsPermit) return;
      holdsPermit = false;
      this.#running--;
      this.#queued.shift()?.run();
    };

    const promise = new Promise<EagerToolResult>((resolve, reject) => {
      const run = () => {
        this.#running++;
        holdsPermit = true;
        this.#controllers.set(toolCallId, { controller, releasePermit });
        const inFlight: Promise<unknown> = execute(controller.signal)
          .then(
            result => {
              // Recorded before resolving, so a discard racing the settlement still sees
              // work that is done rather than work it is entitled to abandon.
              //
              // The step resolves an envelope rather than the tool's value, and it resolves
              // rather than rejects on failure: `{ result, ...call }` when the tool returned,
              // `{ error, ...call }` when it threw, `{ aborted: true, ...call }` when it was
              // cancelled. A result or an error is committed as what it is. An abort is kept
              // as an incomplete call: the tool started, so the saved thread must show it,
              // but it has no outcome to show the next model. Unwrap here so the caller
              // holds the tool's own output.
              const envelope = result as { result?: unknown; error?: unknown; aborted?: boolean } | undefined;
              const settled = !!envelope && typeof envelope === 'object';
              const outcome = !settled
                ? undefined
                : envelope.aborted
                  ? { incomplete: true as const }
                  : 'error' in envelope
                    ? { error: envelope.error }
                    : 'result' in envelope
                      ? { result: envelope.result }
                      : undefined;

              if (call && outcome && !controller.signal.aborted) {
                this.#completed.set(toolCallId, {
                  toolCallId,
                  toolName: call.toolName,
                  args: call.args,
                  ...outcome,
                  sequence,
                });
              }
              resolve(result);
            },
            error => {
              if (eagerToolCallSuspensionIntent(error) && !controller.signal.aborted) {
                this.#suspended.add(toolCallId);
              }
              reject(error);
            },
          )
          .finally(() => {
            // Identity-checked: a discarded attempt and its retry can carry the same
            // toolCallId, so the late settlement of the old one must not evict the
            // controller belonging to the live one.
            if (this.#controllers.get(toolCallId)?.controller === controller) {
              this.#controllers.delete(toolCallId);
            }
            this.#inFlight.delete(inFlight);
            releasePermit();
          });
        this.#inFlight.add(inFlight);
      };

      if (this.#running < this.getConcurrency()) {
        run();
      } else {
        this.#queued.push({
          toolCallId,
          run,
          cancel: () => reject(new EagerToolExecutionNotRun(`"${toolCallId}" was cancelled before it started`)),
        });
      }
    });

    // The foreach adopts this promise later (or never, if the run is cancelled).
    // Keep a handler attached so a rejection is never unhandled.
    promise.catch(() => {});
    this.#executions.set(toolCallId, promise);
    return true;
  }

  /** Number of executions currently running. Exposed for assertions in tests. */
  get running() {
    return this.#running;
  }

  /**
   * Stop dispatching and drop everything that has not started.
   *
   * Without `cancelRunning`, executions already in flight are left alone: the step that
   * follows an unsafe *finish* still runs its foreach, so their results are adopted
   * exactly as the default pipeline would have produced them.
   *
   * With `cancelRunning`, the surrounding model attempt is being thrown away entirely.
   * Those executions are aborted *and* forgotten, so nothing downstream can adopt work
   * belonging to an attempt that no longer exists — including a retry that happens to
   * reuse the same toolCallId, which must execute fresh. Their concurrency permits are
   * released at the same moment: abort is cooperative, and a tool that declines to
   * observe it must not stall the attempt that replaced it.
   */
  stop({
    permanent = false,
    cancelRunning = false,
  }: { permanent?: boolean; cancelRunning?: boolean } = {}): CompletedEagerWork[] {
    this.#stopped = true;
    this.#stoppedPermanently ||= permanent;
    for (const queued of this.#queued.splice(0)) {
      this.#executions.delete(queued.toolCallId);
      queued.cancel();
    }

    // `cancelRunning` is for the one case where the surrounding attempt is thrown away
    // entirely (a model failing mid-stream, then retried or failed over): the normal
    // pipeline never runs those calls, so neither may we. After an unsafe *finish* the
    // foreach still runs and adopts, so running work is left alone there.
    if (!cancelRunning) return [];

    // Work that already finished is the one thing a discard must not throw away: the
    // tool has run, and the replacement attempt would otherwise run it again. Handed
    // back so the caller can commit it into the conversation the replacement sees.
    // Sorted back into model-call order. The map is in settlement order, and a fast
    // second call would otherwise be written into history ahead of a slow first one,
    // which is the one thing this feature promises never to do.
    const completed = [...this.#completed.values()].sort((a, b) => a.sequence - b.sequence);
    this.#completed.clear();

    {
      const cancelled = [...this.#controllers];
      // Cleared first: releasing a permit can start queued work, which must not observe
      // a controller map that still holds the executions being abandoned.
      this.#controllers.clear();
      for (const [toolCallId, running] of cancelled) {
        // Deleting here is belt-and-braces at today's only call site, which opens a new
        // turn immediately after. It is the coordinator's own invariant: cancelled work
        // is never adoptable, whoever calls this and whatever they do next.
        this.#executions.delete(toolCallId);
        running.controller.abort();
        running.releasePermit();
      }
    }

    return completed;
  }

  /**
   * Wait until every execution that has started has settled, however it settles. Called
   * with dispatch already stopped, so nothing new starts meanwhile.
   *
   * A discarded attempt waits here instead of cancelling: a running tool may already have
   * done its side effect, and cancelling it would leave the replacement attempt free to
   * call it again. Settled, its outcome is committed and the replacement sees it as done.
   * An abort of the run stops the wait; the abort exit then waits the work out itself.
   */
  async settleRunning(signal?: AbortSignal) {
    if (signal?.aborted) return;
    let onAbort: (() => void) | undefined;
    const aborted = signal
      ? new Promise<void>(resolve => {
          onAbort = resolve;
          signal.addEventListener('abort', onAbort, { once: true });
        })
      : undefined;
    try {
      while (this.#inFlight.size && !signal?.aborted) {
        const settled = Promise.allSettled([...this.#inFlight]);
        await (aborted ? Promise.race([settled, aborted]) : settled);
      }
    } finally {
      if (onAbort) signal!.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Open a new model turn. A stop caused by a bad turn is scoped to that turn — the
   * next one is a fresh model call and may dispatch again — but a caller abort is
   * permanent. Executions from the previous turn that nothing ever adopted are dropped
   * here so the map cannot grow across a long loop.
   */
  beginTurn() {
    if (this.#stoppedPermanently) return;
    this.#stopped = false;
    this.#completed.clear();
    this.#suspended.clear();
    // Anything the previous turn's foreach never adopted is unreachable now, so drop it
    // rather than let the map grow across a long loop. Entries belonging to a cancelled
    // attempt are already gone; these are merely unclaimed.
    this.#executions.clear();
  }

  /** Whether a call in this attempt has already run up to a runtime `suspend()`. */
  get hasSuspendedHandback() {
    return this.#suspended.size > 0;
  }

  /** Ids currently held for adoption. Exposed for assertions in tests. */
  get pendingAdoptions() {
    return this.#executions.size;
  }

  /**
   * Work surrendered by a discarded attempt, held until a replacement attempt actually
   * starts. Kept on the coordinator rather than in the step's own scope because a retry
   * re-enters the step as a fresh invocation: anything local to the dying attempt is gone
   * by the time its replacement exists. Never committed if no replacement comes — a run
   * that dies must not leave an assistant turn the caller never saw streamed.
   */
  readonly #carried: CompletedEagerWork[] = [];

  /**
   * What has been written into the conversation, by the message id it was written under.
   * Held so that a path which deletes that message can hand the work back to the carry
   * buffer instead of destroying the only record of a side effect that happened.
   *
   * Accumulated per id rather than kept as "the last batch": a chain of failing attempts
   * commits under the same id more than once, and forgetting the earlier batch would let
   * a single `removeByIds` delete work nothing could recover.
   *
   * Entries are only removed by the message they describe being removed, so a run that
   * never does that keeps them until it ends. It holds one entry per attempt that died
   * with finished work, which retry limits bound to a handful.
   */
  readonly #committed = new Map<string, CompletedEagerWork[]>();

  /**
   * Hold a discarded attempt's finished work until a replacement attempt starts. Each
   * batch is sorted into model-call order as it arrives, and batches keep the order they
   * were discarded in. The dispatch counter happens to be run-global, so sorting the whole
   * buffer would agree today — sorting per batch keeps that coincidence from becoming
   * load-bearing.
   */
  carryDiscardedWork(work: CompletedEagerWork[]) {
    this.#carried.push(...[...work].sort((a, b) => a.sequence - b.sequence));
  }

  /** Drain the carried work for committing into the conversation. */
  takeCarriedWork(): CompletedEagerWork[] {
    return this.#carried.splice(0);
  }

  /** Remember what was written where, so a later removal of that message can undo it. */
  recordCommittedWork(messageId: string, work: CompletedEagerWork[]) {
    const existing = this.#committed.get(messageId);
    if (existing) existing.push(...work);
    else this.#committed.set(messageId, [...work]);
  }

  /**
   * Undo a commit whose message is being removed: the work goes back into the carry
   * buffer so the next replacement attempt writes it again. Without this, a processor
   * retry that deletes the attempt's messages would also delete the only record that a
   * tool already ran, and the tool would run a second time.
   *
   * What comes back goes on the end of whatever is already carried, so the resulting
   * order is "work already written once, then work never written".
   */
  recarryCommittedWork(messageId: string) {
    const committed = this.#committed.get(messageId);
    if (!committed) return false;
    this.#committed.delete(messageId);
    this.#carried.push(...committed);
    return true;
  }

  /** Discarded work awaiting a replacement attempt. Exposed for assertions in tests. */
  get carriedWork(): readonly CompletedEagerWork[] {
    return this.#carried;
  }
}

/**
 * Raised when an eager attempt ends without producing an adoptable result, so the
 * normal foreach path must handle the call instead of surfacing the failure. That
 * happens when the attempt is cancelled while still queued, and when an eager call
 * reaches a suspend/bail it should have been excluded from. In the second case the
 * tool's body has already started; only its *result* is discarded.
 */
export class EagerToolExecutionNotRun extends Error {
  readonly [EAGER_NOT_EXECUTED] = true;
  readonly [EAGER_INPUT_ANNOUNCED]: boolean;
  readonly [EAGER_SUSPENSION_INTENT]?: EagerSuspensionIntent;

  constructor(reason: string, options?: { inputAvailableCalled?: boolean; suspension?: EagerSuspensionIntent }) {
    super(`Eager tool execution did not run: ${reason}`);
    this.name = 'EagerToolExecutionNotRun';
    this[EAGER_INPUT_ANNOUNCED] = options?.inputAvailableCalled === true;
    this[EAGER_SUSPENSION_INTENT] = options?.suspension;
  }
}

/**
 * The suspension intent behind this rejection, when the eager attempt was abandoned
 * because the tool called `suspend()` at runtime. The adopting foreach iteration uses
 * it to raise the real suspension rather than running the tool body a second time.
 */
export function eagerToolCallSuspensionIntent(error: unknown): EagerSuspensionIntent | undefined {
  // Walk `cause` for the same reason `eagerToolCallDidNotExecute` does, with the same
  // depth bound: a runtime suspension raises this from inside the tool body, where
  // CoreToolBuilder wraps it in a TOOL_EXECUTION_FAILED MastraError.
  let current: unknown = error;
  for (let depth = 0; depth < 10 && typeof current === 'object' && current !== null; depth++) {
    if (EAGER_SUSPENSION_INTENT in current) {
      return (current as Record<symbol, unknown>)[EAGER_SUSPENSION_INTENT] as EagerSuspensionIntent | undefined;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * True when the eager attempt behind this rejection already ran the tool's
 * `onInputAvailable`. The foreach re-runs `execute` from the top, so it has to skip
 * the announcement it already produced: one call per adoption, the same count the
 * call gets without eager dispatch. (An attempt abandoned in flight is a separate
 * matter: it is never adopted, so the replacement attempt announces again.)
 */
export function eagerToolCallAlreadyAnnouncedInput(error: unknown): boolean {
  // Walk `cause` for the same reason `eagerToolCallDidNotExecute` does, with the same
  // depth bound: a runtime suspension raises this from inside the tool body, where
  // CoreToolBuilder wraps it in a TOOL_EXECUTION_FAILED MastraError.
  let current: unknown = error;
  for (let depth = 0; depth < 10 && typeof current === 'object' && current !== null; depth++) {
    if (EAGER_INPUT_ANNOUNCED in current) return Boolean((current as Record<symbol, unknown>)[EAGER_INPUT_ANNOUNCED]);
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * True when an eager execution ended without an adoptable result, meaning the normal
 * foreach path must handle the call instead of surfacing the failure. The tool body
 * may have started (a runtime suspension gets here); only its result is discarded.
 */
export function eagerToolCallDidNotExecute(error: unknown): boolean {
  // Walk `cause`: a tool that suspends at runtime raises this from inside its own
  // execute, and CoreToolBuilder wraps anything thrown there in a TOOL_EXECUTION_FAILED
  // MastraError. Matching only the top-level error would lose the brand and record the
  // wrapper as the tool's result instead of handing the call back to the foreach.
  let current: unknown = error;
  for (let depth = 0; depth < 10 && typeof current === 'object' && current !== null; depth++) {
    if (EAGER_NOT_EXECUTED in current) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Whitelist deciding what may be executed before the model has finished streaming.
 *
 * This is deliberately an allow-list rather than a list of exclusions. An eager
 * execution that turns out to need approval, suspension or a background dispatch has
 * already emitted chunks and written metadata by the time it discovers that, and none
 * of it can be taken back — so the only safe posture is to start nothing whose shape
 * is not provably a plain server-side call.
 *
 * Eligible means: a resolved, active, locally-executable Mastra tool, with complete
 * arguments, that cannot suspend (mirroring the `isResumableTool` rule in
 * `tool-builder/builder.ts`), cannot require approval, and is not being dispatched as
 * a background task.
 */
export function isEagerlyExecutableToolCall({
  toolCall,
  tool,
  activeTools,
  requireToolApproval,
  autoResumeSuspendedTools,
  hasPostStreamProcessor,
  hasToolResultProcessor,
  isProviderTool,
  getNeedsApprovalFn,
  backgroundTaskManager,
  agentBackgroundConfig,
}: {
  toolCall: { toolName: string; args?: unknown; providerExecuted?: boolean };
  tool: unknown;
  activeTools: string[] | undefined;
  requireToolApproval: unknown;
  autoResumeSuspendedTools: boolean | undefined;
  hasPostStreamProcessor: boolean;
  hasToolResultProcessor: boolean;
  isProviderTool: (tool: any) => boolean;
  getNeedsApprovalFn: (tool: any) => unknown;
  backgroundTaskManager: unknown;
  agentBackgroundConfig: AgentBackgroundConfig | undefined;
}): boolean {
  // A processor that runs after the stream completes is contractually allowed to
  // rewrite or drop the response before any tool runs, so nothing may start early.
  if (hasPostStreamProcessor) return false;

  // Set only when the step carries a provider-executed tool *and* a `processToolResult`
  // processor. A provider result reaching that hook mid-stream can abort the turn before
  // the foreach, and the deferred path would then never start the call at all, so
  // starting one early would make the two schedules disagree about whether it ran.
  // Without a provider tool the hook only sees results after adoption, so dispatch stays on.
  if (hasToolResultProcessor) return false;

  // Arguments must be complete. Partial or absent arguments are never executed.
  if (!toolCall.args || typeof toolCall.args !== 'object') return false;

  // Background dispatch has its own lifecycle in the foreach. The `_background`
  // argument is only the highest-priority input to that decision: agent- or
  // tool-level config dispatches to the background with nothing in the args at
  // all. `isToolBackgroundEligible` is the same base-enabled expression the
  // resolver uses, and exists so these paths cannot disagree.
  if ('_background' in (toolCall.args as Record<string, unknown>)) return false;
  if (
    backgroundTaskManager &&
    isToolBackgroundEligible({
      toolName: toolCall.toolName,
      toolConfig: (tool as { backgroundConfig?: ToolBackgroundConfig } | undefined)?.backgroundConfig,
      agentConfig: agentBackgroundConfig,
    })
  ) {
    return false;
  }

  // Provider-executed and client-side calls are not ours to run.
  if (toolCall.providerExecuted) return false;
  if (!tool || isProviderTool(tool)) return false;
  if (!('execute' in (tool as object)) || typeof (tool as { execute?: unknown }).execute !== 'function') return false;

  // Respect per-step tool filtering. Redundant today, since a filtered tool is absent
  // from the resolved set above and already fails the `!tool` check; kept because that
  // is a property of how tools are resolved, not a guarantee this predicate is given.
  if (activeTools && !activeTools.includes(toolCall.toolName)) return false;

  // Anything that can suspend. `hasSuspendSchema` alone is not enough: agent- and
  // workflow-derived tools suspend without declaring one, which is exactly the rule
  // `isResumableTool` encodes in tools/tool-builder/builder.ts.
  if (autoResumeSuspendedTools) return false;
  if (toolCall.toolName.startsWith('agent-') || toolCall.toolName.startsWith('workflow-')) return false;
  if ('hasSuspendSchema' in (tool as object) && Boolean((tool as { hasSuspendSchema?: unknown }).hasSuspendSchema)) {
    return false;
  }

  // Anything that can require approval, from any of the three sources the foreach
  // consults: the run-level policy, the tool's own flag, and its predicate.
  if (requireToolApproval === true || typeof requireToolApproval === 'function') return false;
  if ('requireApproval' in (tool as object) && Boolean((tool as { requireApproval?: unknown }).requireApproval)) {
    return false;
  }
  // Also redundant today: every path in tool-builder that attaches a `needsApprovalFn`
  // sets `requireApproval` to true alongside it, so the check above already caught this.
  // Kept because this predicate must not depend on that pairing holding forever.
  if (getNeedsApprovalFn(tool)) return false;

  return true;
}
