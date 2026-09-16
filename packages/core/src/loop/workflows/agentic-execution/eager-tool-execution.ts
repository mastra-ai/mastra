type EagerToolResult = unknown;

/**
 * Marker placed on the workflow execution context when `toolCallStep` is invoked
 * eagerly from the LLM execution step. Its presence tells the step not to look
 * for (and await) an eager execution of itself.
 */
export const EAGER_TOOL_EXECUTION_MARKER = Symbol('eager-tool-execution');

/** Brands errors raised before the tool's own `execute` ever ran. */
const EAGER_NOT_EXECUTED = Symbol('eager-tool-not-executed');

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
  #running = 0;
  #stopped = false;

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
  start(toolCallId: string, execute: () => Promise<EagerToolResult>) {
    if (this.#stopped || this.#executions.has(toolCallId)) return false;

    const promise = new Promise<EagerToolResult>((resolve, reject) => {
      const run = () => {
        this.#running++;
        void execute()
          .then(resolve, reject)
          .finally(() => {
            this.#running--;
            this.#queued.shift()?.run();
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
   * Stop dispatching, and drop everything that has not started. Executions already
   * running are left to settle — their abort signal is the cancellation mechanism,
   * and the foreach still adopts whatever they produce so a real side effect is
   * never silently discarded.
   */
  stop() {
    this.#stopped = true;
    for (const queued of this.#queued.splice(0)) {
      this.#executions.delete(queued.toolCallId);
      queued.cancel();
    }
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
}: {
  toolCall: { toolName: string; args?: unknown; providerExecuted?: boolean };
  tool: unknown;
  activeTools: string[] | undefined;
  requireToolApproval: unknown;
  autoResumeSuspendedTools: boolean | undefined;
  hasPostStreamProcessor: boolean;
  isProviderTool: (tool: any) => boolean;
  getNeedsApprovalFn: (tool: any) => unknown;
}): boolean {
  // A processor that runs after the stream completes is contractually allowed to
  // rewrite or drop the response before any tool runs, so nothing may start early.
  if (hasPostStreamProcessor) return false;

  // Arguments must be complete. Partial or absent arguments are never executed.
  if (!toolCall.args || typeof toolCall.args !== 'object') return false;

  // Background dispatch has its own lifecycle in the foreach.
  if ('_background' in (toolCall.args as Record<string, unknown>)) return false;

  // Provider-executed and client-side calls are not ours to run.
  if (toolCall.providerExecuted) return false;
  if (!tool || isProviderTool(tool)) return false;
  if (!('execute' in (tool as object)) || typeof (tool as { execute?: unknown }).execute !== 'function') return false;

  // Respect per-step tool filtering; the foreach rejects inactive tools.
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
  if (getNeedsApprovalFn(tool)) return false;

  return true;
}
