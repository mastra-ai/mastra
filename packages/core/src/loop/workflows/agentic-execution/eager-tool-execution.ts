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

/** Brands errors raised before the tool's own `execute` ever ran. */
const EAGER_NOT_EXECUTED = Symbol('eager-tool-not-executed');

type RunningExecution = {
  controller: AbortController;
  releasePermit: () => void;
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
  #running = 0;
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
    return execution;
  }

  /**
   * Start an eager execution keyed by canonical `toolCallId`. Returns false when the
   * coordinator is stopped or the id is already in flight, so a replayed or duplicate
   * id within the same step can never execute twice.
   */
  start(toolCallId: string, execute: (abortSignal: AbortSignal) => Promise<EagerToolResult>) {
    if (this.#stopped || this.#executions.has(toolCallId)) return false;

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
        void execute(controller.signal)
          .then(resolve, reject)
          .finally(() => {
            // Identity-checked: a discarded attempt and its retry can carry the same
            // toolCallId, so the late settlement of the old one must not evict the
            // controller belonging to the live one.
            if (this.#controllers.get(toolCallId)?.controller === controller) {
              this.#controllers.delete(toolCallId);
            }
            releasePermit();
          });
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
  stop({ permanent = false, cancelRunning = false }: { permanent?: boolean; cancelRunning?: boolean } = {}) {
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
    if (cancelRunning) {
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
    // Anything the previous turn's foreach never adopted is unreachable now, so drop it
    // rather than let the map grow across a long loop. Entries belonging to a cancelled
    // attempt are already gone; these are merely unclaimed.
    this.#executions.clear();
  }

  /** Ids currently held for adoption. Exposed for assertions in tests. */
  get pendingAdoptions() {
    return this.#executions.size;
  }
}

/**
 * Raised when an eager attempt ends without the tool's `execute` ever running, so the
 * normal foreach path must handle the call instead of surfacing the failure. That
 * happens when the attempt is cancelled while still queued, and defensively if an
 * eager call ever reaches a suspend/bail it should have been excluded from.
 */
export class EagerToolExecutionNotRun extends Error {
  readonly [EAGER_NOT_EXECUTED] = true;

  constructor(reason: string) {
    super(`Eager tool execution did not run: ${reason}`);
    this.name = 'EagerToolExecutionNotRun';
  }
}

/**
 * True when an eager execution failed without the tool ever running, meaning the
 * normal foreach path must handle the call instead of surfacing the failure.
 */
export function eagerToolCallDidNotExecute(error: unknown): boolean {
  return typeof error === 'object' && error !== null && EAGER_NOT_EXECUTED in error;
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
  isProviderTool: (tool: any) => boolean;
  getNeedsApprovalFn: (tool: any) => unknown;
  backgroundTaskManager: unknown;
  agentBackgroundConfig: AgentBackgroundConfig | undefined;
}): boolean {
  // A processor that runs after the stream completes is contractually allowed to
  // rewrite or drop the response before any tool runs, so nothing may start early.
  if (hasPostStreamProcessor) return false;

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
