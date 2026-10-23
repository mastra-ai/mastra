import type { MCPDetailedTask, MCPTask, MCPTaskInputResponses } from '../../shared/tasks';

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
 * Where `MCPServer` keeps MCP tasks. The `tasks/*` handlers only call these four methods; how the
 * work runs (in-process, as a workflow run, on a background-task worker) is up to the store and
 * whatever executes the task.
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
}
