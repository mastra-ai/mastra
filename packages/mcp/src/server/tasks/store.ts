import type { CallToolResult } from '@modelcontextprotocol/server';
import type { MCPDetailedTask, MCPTask, MCPTaskInputRequests, MCPTaskInputResponses } from '../../shared/tasks';

/**
 * What {@link MCPTaskStore.create} durably records.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskCreateParams {
  /** Retention from creation in ms; `null` keeps the task until the store is cleared. */
  ttlMs: number | null;
  /** Fixed poll interval to suggest. Omit to let the store suggest one that grows with the task's age. */
  pollIntervalMs?: number;
  /** The authenticated caller that created the task. Only the same principal can read, answer or cancel it. */
  principal: string;
  /** Store-defined data the server's execution needs to find the work again, e.g. a workflow run id. */
  context?: Record<string, unknown>;
  /** The span of the request that created the task. Kept with the task so every attempt joins its trace. */
  trace?: MCPTaskTrace;
}

/**
 * Where a task's trace starts: the span of the `tools/call` that created it.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskTrace {
  traceId: string;
  spanId: string;
}

/**
 * The caller presented on a `tasks/*` request.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskAccess {
  principal: string;
}

/**
 * Where `MCPServer` keeps MCP tasks. The `tasks/*` handlers call `get`, `update` and `cancel`;
 * `MCPServer` creates a task and hands its work to `run`. Where the work runs (in-process, on a
 * background-task worker) is up to the store.
 *
 * - `create` must not resolve before an immediate `get(taskId)` would succeed, including on another
 *   instance when the store is shared (SEP-2663 durable creation).
 * - `get`, `update` and `cancel` resolve `undefined`/`false` for an unknown, expired or
 *   foreign-principal task. The server answers all three cases with the same `-32602`.
 * - `update` ignores unknown and already-answered input keys.
 * - `cancel` is cooperative: it acknowledges, and the task may still complete or fail. It is a no-op
 *   on terminal tasks.
 * - There is deliberately no `list`: task ids are bearer tokens and must not be enumerable.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskStore {
  create(params: MCPTaskCreateParams): Promise<MCPTask>;
  get(taskId: string, access: MCPTaskAccess): Promise<MCPDetailedTask | undefined>;
  update(taskId: string, inputResponses: MCPTaskInputResponses, access: MCPTaskAccess): Promise<boolean>;
  cancel(taskId: string, access: MCPTaskAccess): Promise<boolean>;
  /**
   * Drives `work` for a task this store created: runs it now, runs it again with `resume` once every
   * open input key is answered, and records each outcome. A rejected attempt marks the task `failed`
   * (-32603). Outcomes that arrive after the task is terminal are ignored.
   *
   * `work` must be a pure function of the `context` given to `create`, so a store that outlives the
   * process can rebuild and dispatch it again. With `options.initialAttempt`, that attempt stands in
   * for the first call to `work`; every later attempt still goes through `work`.
   */
  run(taskId: string, work: MCPTaskWork, options?: MCPTaskRunOptions): void;
  /**
   * The trace given to `create`, for a caller that may `get` the task; `undefined` otherwise.
   * Lets `tasks/update` and `tasks/cancel` join the task's trace. Optional: without it they are
   * traced on their own.
   */
  traceOf?(taskId: string, access: MCPTaskAccess): Promise<MCPTaskTrace | undefined>;
}

/** @experimental SEP-2663 extension; API may change. */
export interface MCPTaskRunOptions {
  /**
   * A first attempt already running in this process, e.g. an `'auto'` tool that outlived its sync
   * window. The store awaits `outcome` as attempt 1 instead of calling `work`, and calls `abort`
   * if the task is cancelled or expires meanwhile.
   *
   * It is process-local and never persisted: it may hold request-local state, so a durable store
   * treats it as process-affine and never dispatches it elsewhere.
   */
  initialAttempt?: {
    outcome: Promise<MCPTaskAttemptOutcome>;
    abort: (reason?: unknown) => void;
  };
}

/**
 * One run of a task's work. The first attempt has no `resume`; after an `input_required` outcome
 * the next attempt receives the client's answers.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskAttempt {
  /** Aborts when the task is cancelled or expires. */
  signal: AbortSignal;
  /**
   * The task's trace and which attempt this is, for the attempt's span. A store that omits it runs
   * the attempt untraced.
   */
  trace?: MCPTaskAttemptTrace;
  resume?: {
    /** The answers to every key the previous attempt asked for. */
    inputResponses: MCPTaskInputResponses;
    /** What the previous attempt handed back with its input requests. */
    suspendPayload: unknown;
  };
}

/**
 * How one attempt ended. Errors raised by the work itself belong in a `completed` result with
 * `isError: true`; only a rejected attempt makes the task `failed`.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export type MCPTaskAttemptOutcome =
  | { status: 'completed'; result: CallToolResult }
  | {
      status: 'input_required';
      /** Keys must be unique over the task's lifetime; a reused key fails the task. */
      inputRequests: MCPTaskInputRequests;
      suspendPayload?: unknown;
    };

/** @experimental SEP-2663 extension; API may change. */
export interface MCPTaskAttemptTrace extends MCPTaskTrace {
  /** The task's key, `taskKeyOf(taskId)`: safe to record, unlike the id. */
  taskKey: string;
  /** 1 for the first run; counts every retry and resume. */
  attempt: number;
  /** Run again with the answers to an `input_required` outcome. */
  resumed: boolean;
  /** Run again because an earlier attempt was lost with its process. */
  recovered: boolean;
}

/** @experimental SEP-2663 extension; API may change. */
export type MCPTaskWork = (attempt: MCPTaskAttempt) => Promise<MCPTaskAttemptOutcome>;
