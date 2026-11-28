/**
 * Code Mode — Types
 *
 * Code Mode lets an LLM write and execute a single TypeScript program that
 * orchestrates other Mastra tools as `external_*` functions. The program runs
 * inside a WorkspaceSandbox; each `external_*` call RPCs back to the host where
 * the real Mastra tool executes (preserving validation, tracing, request
 * context, and the `mastra` instance).
 */

import type { ToolsInput } from '../../agent/types';
import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';

/**
 * Configuration for {@link createCodeMode} and the lower-level factories.
 */
export interface CodeModeConfig {
  /**
   * Tools exposed to the sandboxed program as `external_<id>` functions.
   * Only these tools may be invoked from generated code (allow-list).
   */
  tools: ToolsInput;

  /**
   * Sandbox used to execute the generated program. When omitted, the tool uses
   * the workspace sandbox from the execution context. If neither is available,
   * execution throws — there is no implicit host fallback. Pass
   * `new LocalSandbox()` to run on the host explicitly.
   */
  sandbox?: WorkspaceSandbox;

  /** Execution timeout in milliseconds. Default: 30000. */
  timeout?: number;

  /** The generated tool's id. Default: `execute_typescript`. */
  id?: string;

  /**
   * Maximum number of `external_*` calls a single program may attempt.
   *
   * Exceeding it fails the whole run with a {@link CodeModeLimitError} naming
   * `maxCalls`, even when the guest code catches the individual rejection.
   * Must be a positive integer. Optional; omitted means unlimited.
   */
  maxCalls?: number;

  /**
   * Maximum number of `external_*` calls allowed to execute concurrently.
   *
   * Additional calls queue (FIFO) instead of failing. Must be a positive
   * integer. Optional; omitted means unlimited.
   */
  maxConcurrentCalls?: number;

  /**
   * Maximum UTF-8 byte size of each nested tool result.
   *
   * A result exceeding it fails the whole run with a
   * {@link CodeModeLimitError} naming `maxResultBytes`, even when the guest
   * code catches the individual rejection. Applies to each nested tool result,
   * not the program's final return value. Must be a non-negative integer.
   * Optional; omitted means unlimited.
   */
  maxResultBytes?: number;

  /**
   * Maximum UTF-8 bytes of captured console logs.
   *
   * Each retained line costs at least one byte, so a finite cap always bounds
   * the number of lines too. Overflow truncates the logs — the program still
   * succeeds. Must be a non-negative integer (0 captures no logs). Optional;
   * omitted means unlimited.
   */
  maxLogBytes?: number;

  /**
   * Maximum number of captured console log lines.
   *
   * Overflow truncates the logs — the program still succeeds. Must be a
   * non-negative integer (0 captures no logs). Optional; omitted means
   * unlimited.
   */
  maxLogLines?: number;
}

/**
 * Error raised when a configured Code Mode execution limit is exceeded.
 *
 * `option` and `value` name the exact {@link CodeModeConfig} option that
 * tripped and its configured value, so callers can distinguish a call-count
 * or result-size failure without parsing the message. Call and result limits
 * are sticky: once one trips, the run fails even if guest code caught the
 * individual rejection.
 */
export class CodeModeLimitError extends Error {
  /** The config option that tripped: `maxCalls` or `maxResultBytes`. */
  readonly option: 'maxCalls' | 'maxResultBytes';
  /** The configured value of that option. */
  readonly value: number;

  constructor(option: 'maxCalls' | 'maxResultBytes', value: number, detail?: string) {
    super(`Code Mode execution limit exceeded: ${option} (configured ${value})${detail ? ` — ${detail}` : ''}`);
    this.name = 'CodeModeLimitError';
    this.option = option;
    this.value = value;
  }
}

/**
 * Result returned by the `execute_typescript` tool.
 */
export interface CodeModeToolResult {
  /** Whether the program ran to completion without throwing. */
  success: boolean;
  /** The value returned by the executed program. */
  result?: unknown;
  /** Captured console output (log/info/warn/error), in order. */
  logs?: string[];
  /** Populated when the program threw or failed to execute. */
  error?: {
    message: string;
    name?: string;
    line?: number;
  };
}

/**
 * A single JSON-RPC request emitted by the sandboxed runner when it calls an
 * `external_*` function. `id` correlates the response so concurrent calls
 * (e.g. `Promise.all`) can resolve out of order.
 */
export interface CodeModeRpcRequest {
  type: 'rpc';
  id: number;
  /** Tool id being invoked (without the `external_` prefix). */
  tool: string;
  /** Validated-on-host arguments for the tool. */
  args: unknown;
}

/** Host -> runner response to a {@link CodeModeRpcRequest}. */
export interface CodeModeRpcResponse {
  type: 'rpc-result';
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message: string; name?: string };
}

/** A captured console line emitted by the runner. */
export interface CodeModeLogEvent {
  type: 'log';
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
}

/** Terminal frame emitted by the runner when the program finishes. */
export interface CodeModeDoneEvent {
  type: 'done';
  ok: boolean;
  result?: unknown;
  error?: { message: string; name?: string; line?: number };
}

/** Any frame the runner can emit on its protocol channel. */
export type CodeModeRunnerFrame = CodeModeRpcRequest | CodeModeLogEvent | CodeModeDoneEvent;

/**
 * Host-side handler that executes a single allow-listed tool call on behalf of
 * the sandboxed program. Implemented by the tool; consumed by the transport.
 */
export type CodeModeToolDispatcher = (tool: string, args: unknown) => Promise<unknown>;

/**
 * Transport abstraction so alternative channels (loopback socket, file queue)
 * can be added for remote sandboxes without changing the tool. v1 ships a
 * stdio JSON-RPC implementation over `sandbox.processes.spawn`.
 */
export interface CodeModeTransport {
  /**
   * Whether this transport executes programs in a WorkspaceSandbox. Defaults
   * to `true`. In-process transports (e.g. V8 isolates) that provide their own
   * execution boundary set this to `false`, which lets `createCodeMode` run
   * without a sandbox configured.
   */
  readonly requiresSandbox?: boolean;

  /**
   * Run the runner (with the already-stripped JS program) in the sandbox,
   * dispatching `external_*` calls through `dispatch`, and resolve once the
   * program finishes.
   */
  run(opts: {
    /** Present unless the transport declares `requiresSandbox: false`. */
    sandbox?: WorkspaceSandbox;
    /** Plain JS (TypeScript already stripped) program body. */
    program: string;
    /** Allow-listed tool ids exposed as `external_<id>`. */
    toolIds: string[];
    dispatch: CodeModeToolDispatcher;
    timeout: number;
    abortSignal?: AbortSignal;
    /** Optional per-call hooks for tracing. */
    onExternalCall?: (tool: string, args: unknown) => void;
    onExternalResult?: (tool: string, durationMs: number, error?: unknown) => void;

    /**
     * Maximum UTF-8 bytes of captured console logs. A transport that buffers
     * logs during execution should honor this to keep its memory bounded;
     * each retained line should cost at least one byte so a finite cap also
     * bounds the line count. Omitted means unlimited. Core additionally
     * replays the returned logs through the same cap as a compatibility guard.
     */
    maxLogBytes?: number;
    /**
     * Maximum number of captured console log lines. A transport that buffers
     * logs during execution should honor this; omitted means unlimited.
     */
    maxLogLines?: number;
  }): Promise<CodeModeToolResult>;
}
