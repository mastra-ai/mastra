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
 * Owns a single permit source so eager work honours the same concurrency limit the
 * foreach would have applied.
 */
export class EagerToolExecutionCoordinator {
  readonly #executions = new Map<string, Promise<EagerToolResult>>();
  readonly #queued: QueuedExecution[] = [];
  #running = 0;
  #stopped = false;

  constructor(readonly concurrency: number) {}

  /** The in-flight eager execution for a tool call, if one was started. */
  get(toolCallId: string) {
    return this.#executions.get(toolCallId);
  }

  /**
   * Start an eager execution keyed by canonical `toolCallId`. Returns false when the
   * coordinator is stopped or the id was already dispatched, so a replayed or duplicate
   * id can never execute twice.
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

      if (this.#running < this.concurrency) {
        run();
      } else {
        this.#queued.push({
          toolCallId,
          run,
          cancel: () => reject(new EagerToolExecutionStopped(toolCallId)),
        });
      }
    });

    // The foreach adopts this promise later (or never, if the run is cancelled).
    // Keep a handler attached so a rejection is never unhandled.
    promise.catch(() => {});
    this.#executions.set(toolCallId, promise);
    return true;
  }

  /**
   * Stop dispatching. Executions already running are left to settle (their abort
   * signal is the cancellation mechanism); queued executions that never started are
   * dropped so the normal foreach path remains authoritative for them.
   */
  stop() {
    this.#stopped = true;
    for (const queued of this.#queued.splice(0)) {
      this.#executions.delete(queued.toolCallId);
      queued.cancel();
    }
  }
}

class EagerToolExecutionStopped extends Error {
  readonly [EAGER_NOT_EXECUTED] = true;

  constructor(toolCallId: string) {
    super(`Eager tool execution for "${toolCallId}" was cancelled before it started`);
    this.name = 'EagerToolExecutionStopped';
  }
}

/**
 * Thrown from inside an eager execution when the call turns out to need a path the
 * eager dispatcher cannot provide (a suspension, for example). It is raised before
 * the tool's `execute` runs, so the foreach can safely run the call normally.
 */
export class EagerToolExecutionIneligible extends Error {
  readonly [EAGER_NOT_EXECUTED] = true;

  constructor(reason: string) {
    super(`Tool call is not eligible for eager execution: ${reason}`);
    this.name = 'EagerToolExecutionIneligible';
  }
}

/**
 * True when an eager execution failed without the tool ever running, meaning the
 * normal foreach path must handle the call instead of surfacing the failure.
 */
export function eagerToolCallDidNotExecute(error: unknown): boolean {
  return typeof error === 'object' && error !== null && EAGER_NOT_EXECUTED in error;
}
