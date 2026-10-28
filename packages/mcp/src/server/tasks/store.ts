import { createHash } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/server';
import type {
  MCPDetailedTask,
  MCPTask,
  MCPTaskInputRequests,
  MCPTaskInputResponses,
  MCPTaskStatus,
} from '../../shared/tasks';

export { taskKeyOf } from '../../shared/tasks';

/** How a principal is stored and shown. Principals can carry user and subject ids, so only their hash is kept. */
export function principalKeyOf(principal: string): string {
  return createHash('sha256').update(principal).digest('base64url');
}

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
  /**
   * Most open (`working` or `input_required`) tasks allowed for this principal and for the whole
   * store, counting the one being created. Over either, `create` rejects with
   * {@link MCPTaskLimitError} and records nothing. Omitted: no limit.
   */
  limits?: MCPTaskLimits;
}

/** @experimental SEP-2663 extension; API may change. */
export interface MCPTaskLimits {
  perPrincipal: number;
  total: number;
}

/**
 * Thrown by {@link MCPTaskStore.create} when the task would go over one of its `limits`.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export class MCPTaskLimitError extends Error {
  constructor(
    readonly scope: 'principal' | 'total',
    readonly limit: number,
  ) {
    super(`Too many open MCP tasks ${scope === 'principal' ? 'for this principal' : 'in this store'} (limit ${limit})`);
    this.name = 'MCPTaskLimitError';
  }
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
 * - `create` enforces `limits` by rejecting with {@link MCPTaskLimitError}. A store that ignores
 *   `limits` caps nothing.
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

/**
 * A task as an {@link MCPTaskStoreAdmin} lists it. Carries the task key, never the task id.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskListing {
  taskKey: string;
  /** The principal that created the task, hashed with {@link principalKeyOf}. */
  principalKey: string;
  /** Who sent the task, readable for operators (see `clientLabelOf`); never a credential. */
  clientLabel?: string;
  /** The `context` given to `create`. */
  context?: Record<string, unknown>;
  status: MCPTaskStatus;
  statusMessage?: string;
  createdAt: string;
  lastUpdatedAt: string;
  ttlMs: number | null;
  /** Open input requests, while `input_required`. */
  inputRequests?: MCPTaskInputRequests;
  result?: Record<string, unknown>;
  /** A JSON-RPC error object. */
  error?: Record<string, unknown>;
}

/**
 * Filters for {@link MCPTaskStoreAdmin.list}. Every filter narrows the result.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskListOptions {
  /** At most this many tasks. Default 50. */
  limit?: number;
  /** `nextCursor` of the previous page. */
  cursor?: string;
  status?: MCPTaskStatus;
  /** The tool, workflow or agent name the task runs (`context.toolName`). */
  surface?: string;
  principalKey?: string;
  taskKey?: string;
}

/** @experimental SEP-2663 extension; API may change. */
export interface MCPTaskListPage {
  listings: MCPTaskListing[];
  nextCursor?: string;
}

/**
 * Pages lists by creation time. The cursor holds the last listed creation time and the keys
 * already listed at that time, so tasks created in the same millisecond are neither lost nor repeated.
 */
interface TaskListCursor {
  before: string;
  seen: string[];
}

export function decodeTaskListCursor(cursor: string | undefined): TaskListCursor | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<TaskListCursor>;
    if (typeof parsed.before === 'string' && !Number.isNaN(Date.parse(parsed.before)) && Array.isArray(parsed.seen)) {
      return { before: parsed.before, seen: parsed.seen.filter(key => typeof key === 'string') };
    }
  } catch {
    // An unreadable cursor lists from the start.
  }
  return undefined;
}

/** Whether a task comes after the cursor in newest-first order. */
export function isPastTaskListCursor(listing: MCPTaskListing, cursor: TaskListCursor | undefined): boolean {
  if (!cursor) return true;
  const created = Date.parse(listing.createdAt);
  const before = Date.parse(cursor.before);
  return created < before || (created === before && !cursor.seen.includes(listing.taskKey));
}

/** The cursor for the page after `listings`, newest first. */
export function nextTaskListCursor(
  listings: MCPTaskListing[],
  previous: TaskListCursor | undefined,
): string | undefined {
  const last = listings.at(-1);
  if (!last) return undefined;
  const before = Date.parse(last.createdAt);
  const seen = listings.filter(listing => Date.parse(listing.createdAt) === before).map(listing => listing.taskKey);
  if (previous && Date.parse(previous.before) === before) seen.push(...previous.seen);
  const cursor: TaskListCursor = { before: new Date(before).toISOString(), seen };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

/** Whether a listing matches the filters a store could not apply while reading. */
export function matchesTaskListOptions(listing: MCPTaskListing, options: MCPTaskListOptions): boolean {
  if (options.status && listing.status !== options.status) return false;
  if (options.surface && listing.context?.toolName !== options.surface) return false;
  if (options.principalKey && listing.principalKey !== options.principalKey) return false;
  if (options.taskKey && listing.taskKey !== options.taskKey) return false;
  return true;
}

/**
 * What an admin action on a task did: `not_found` for an unknown or expired task, `ignored` when the
 * task was found but nothing changed (already finished, or not waiting for those inputs).
 *
 * @experimental SEP-2663 extension; API may change.
 */
export type MCPTaskAdminOutcome = 'done' | 'ignored' | 'not_found';

/**
 * Optional admin view of an {@link MCPTaskStore}, for Studio. It is not part of the protocol, and
 * works on task keys ({@link taskKeyOf}) rather than task ids, across all principals. `updateByKey`
 * and `cancelByKey` must run the same code as `update` and `cancel`.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskStoreAdmin {
  /** Most recently created first. `nextCursor` is set when more tasks match. */
  list(options?: MCPTaskListOptions): Promise<MCPTaskListPage>;
  updateByKey(taskKey: string, inputResponses: MCPTaskInputResponses): Promise<MCPTaskAdminOutcome>;
  cancelByKey(taskKey: string): Promise<MCPTaskAdminOutcome>;
}

/** @experimental SEP-2663 extension; API may change. */
export function isMCPTaskStoreAdmin(store: MCPTaskStore): store is MCPTaskStore & MCPTaskStoreAdmin {
  const admin = store as Partial<MCPTaskStoreAdmin>;
  return (
    typeof admin.list === 'function' &&
    typeof admin.updateByKey === 'function' &&
    typeof admin.cancelByKey === 'function'
  );
}

/** Projects a detailed task onto a listing. */
export function toListing(
  taskKey: string,
  principalKey: string,
  context: Record<string, unknown> | undefined,
  task: MCPDetailedTask,
  clientLabel?: string,
): MCPTaskListing {
  return {
    taskKey,
    principalKey,
    ...(clientLabel !== undefined && { clientLabel }),
    ...(context && { context }),
    status: task.status,
    ...(task.statusMessage !== undefined && { statusMessage: task.statusMessage }),
    createdAt: task.createdAt,
    lastUpdatedAt: task.lastUpdatedAt,
    ttlMs: task.ttlMs,
    ...(task.status === 'input_required' && { inputRequests: task.inputRequests }),
    ...(task.status === 'completed' && { result: task.result }),
    ...(task.status === 'failed' && { error: task.error }),
  };
}
