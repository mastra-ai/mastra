import type { IMastraLogger } from '../../../logger';
import { ensureSerializable } from '../../../utils/safe-stringify';

export type ExecuteToolOutcome =
  /** Execution completed. `result` is the serializable value engines should
   * persist; `rawResult` is the live return value for consumers that need
   * pre-serialization side channels (e.g. the durable engine's in-step
   * `toModelOutput` mapping, which reads symbols the JSON round-trip strips). */
  | { status: 'success'; result: unknown; rawResult: unknown }
  /** Execution threw while the request abort signal was set — a mid-flight
   * cancellation, not a genuine failure. Engines leave the call incomplete. */
  | { status: 'aborted' }
  /** Execution threw. Engines own error serialization (their persisted error
   * shapes differ), so the raw error is returned. */
  | { status: 'error'; error: unknown };

/**
 * Shared synchronous tool execution behavior (PHASE3 Step 4): run the tool,
 * make the result serialization-safe, fire the `onOutput` lifecycle hook, and
 * classify failures. Both engines' tool-call steps call this after their
 * approval/background ladders have fallen through to direct execution.
 *
 * Adjudications:
 * - `onOutput` receives `abortSignal` (ledger L6): previously main-only; tools
 *   observing cancellation in their output hook now work on both engines.
 * - Abort-aware failure classification (ledger L7): previously main-only. A
 *   throw while the request is aborted must not be recorded as an error
 *   result — that would fake-complete the call (its `result` becomes the
 *   abort message) and read as success on resume. Key off the abort signal,
 *   not the error type: CoreToolBuilder wraps the AbortError in a
 *   TOOL_EXECUTION_FAILED MastraError, so isAbortError(error) wouldn't match.
 * - `ensureSerializable` (previously main-only) is a fast-path guard: it
 *   returns the same reference unless the value has cycles/BigInts, so the
 *   durable engine's raw-result consumers are unaffected in the common case
 *   while cyclic results no longer break workflow-state serialization.
 * - FGA authorization denials are re-thrown, never serialized as recoverable
 *   tool errors for the LLM to retry (both engines already agreed).
 *
 * `acquireExecution` is an engine hook (deliberate, not drift): the durable
 * engine brackets live execution with `markRunActive` so run-activity
 * tracking spans the tool call; the main loop has no such bookkeeping.
 */
export async function executeToolCall(deps: {
  tool: {
    execute: (args: any, options: any) => Promise<unknown> | unknown;
    onOutput?: (params: {
      toolCallId: string;
      toolName: string;
      output: unknown;
      abortSignal?: AbortSignal;
    }) => Promise<void> | void;
  };
  args: unknown;
  toolOptions: unknown;
  toolCallId: string;
  toolName: string;
  abortSignal?: AbortSignal;
  /** Engine wrapper around live execution (e.g. durable's `markRunActive`); returns a release fn. */
  acquireExecution?: () => () => void;
  logger?: IMastraLogger;
}): Promise<ExecuteToolOutcome> {
  const { tool, toolCallId, toolName, abortSignal, logger } = deps;

  try {
    const release = deps.acquireExecution?.();
    let rawResult: unknown;
    try {
      rawResult = await tool.execute(deps.args, deps.toolOptions);
    } finally {
      release?.();
    }
    const result = ensureSerializable(rawResult);

    if ('onOutput' in tool && typeof tool.onOutput === 'function') {
      try {
        await tool.onOutput({ toolCallId, toolName, output: result, abortSignal });
      } catch (hookError) {
        logger?.error?.('Error calling onOutput', hookError);
      }
    }

    return { status: 'success', result, rawResult };
  } catch (error) {
    // Re-throw FGA authorization errors instead of swallowing them — an
    // authorization denial must fail the run, not be serialized as a
    // recoverable tool error for the LLM to retry.
    if (error instanceof Error && error.name === 'FGADeniedError') {
      throw error;
    }
    if (abortSignal?.aborted) {
      // Log the discarded error for observability (control flow unchanged).
      logger?.debug?.('Tool execution interrupted by request abort; leaving the tool call incomplete', {
        toolName,
        toolCallId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'aborted' };
    }
    return { status: 'error', error };
  }
}
