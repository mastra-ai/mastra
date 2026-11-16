import type { TripWire } from '../../../agent/trip-wire';

type ToolCallOutput = {
  toolCallId: string;
  result?: unknown;
  error?: unknown;
  aborted?: boolean;
  providerExecuted?: boolean;
  approval?: { approved?: boolean };
};

export type ToolResultEmission = { ok: true } | { ok: false; tripwire: TripWire };

/** Streams, processes and commits one successful tool result. */
export type ToolResultEmitter = (toolCall: any, llmExecutionResult: any) => Promise<ToolResultEmission>;

/**
 * Streams the result of each parallel tool call as soon as that call finishes (#21902),
 * instead of holding every result until the slowest call in the step is done.
 *
 * The foreach over tool calls hands each finished call to `settle()`. Emissions run one at
 * a time in completion order through the same emitter the mapping step uses, so output
 * processors never see two tool results at once. The mapping step then `take()`s each call
 * in call order and skips work already done. After a `processToolResult` tripwire, later
 * results are not emitted; the mapping step ends the run with that tripwire.
 */
export class EarlyToolResultStream {
  #emitter?: ToolResultEmitter;
  #enabled = false;
  #queue: Promise<unknown> = Promise.resolve();
  #emissions = new Map<string, Promise<ToolResultEmission | undefined>>();
  #tripwire?: TripWire;

  setEmitter(emitter: ToolResultEmitter) {
    this.#emitter = emitter;
  }

  /** Start a new step's tool-call batch. Early emission only applies to batches that run in parallel. */
  begin(parallel: boolean) {
    this.#enabled = parallel;
    this.#emissions.clear();
    this.#tripwire = undefined;
  }

  /** Queue the call's result for streaming. Returns whether it was queued. */
  settle(output: ToolCallOutput | undefined, llmExecutionResult: unknown): boolean {
    const emitter = this.#emitter;
    if (!this.#enabled || !emitter || !output || !llmExecutionResult) return false;
    if (output.result === undefined || output.error || output.aborted || output.providerExecuted) return false;
    if (output.approval?.approved === false) return false;

    const emission = this.#queue.then(async () => {
      if (this.#tripwire) return undefined;
      const outcome = await emitter(output, llmExecutionResult);
      if (!outcome.ok) this.#tripwire = outcome.tripwire;
      return outcome;
    });
    // Keep the queue going after a failed emission; the failure surfaces from `take()`.
    this.#queue = emission.catch(() => {});
    this.#emissions.set(output.toolCallId, emission);
    return true;
  }

  /** Wait for queued emissions and return the tripwire raised by one of them, if any. */
  async tripwire(): Promise<TripWire | undefined> {
    await this.#queue;
    return this.#tripwire;
  }

  /** Whether the call's result was already streamed and committed (rethrows a failed emission). */
  async take(toolCallId: string): Promise<boolean> {
    const emission = this.#emissions.get(toolCallId);
    if (!emission) return false;
    this.#emissions.delete(toolCallId);
    return (await emission)?.ok === true;
  }
}
