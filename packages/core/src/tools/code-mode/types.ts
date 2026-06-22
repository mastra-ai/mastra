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
   * Run the runner (with the already-stripped JS program) in the sandbox,
   * dispatching `external_*` calls through `dispatch`, and resolve once the
   * program finishes.
   */
  run(opts: {
    sandbox: WorkspaceSandbox;
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
  }): Promise<CodeModeToolResult>;
}
