/**
 * Wire constants for the MCP Tasks extension (SEP-2663, protocol revision 2026-07-28).
 *
 * @experimental SEP-2663 extension; API may change.
 */

/** Extension identifier used as the key under `capabilities.extensions`. */
export const TASKS_EXTENSION_ID = 'io.modelcontextprotocol/tasks';

export const TASKS_METHODS = {
  get: 'tasks/get',
  update: 'tasks/update',
  cancel: 'tasks/cancel',
} as const;

/** `resultType` of a `tools/call` result that is a task handle instead of a `CallToolResult`. */
export const TASK_RESULT_TYPE = 'task';

export const TASK_STATUSES = ['working', 'input_required', 'completed', 'failed', 'cancelled'] as const;

export type MCPTaskStatus = (typeof TASK_STATUSES)[number];

const TERMINAL_STATUSES: ReadonlySet<MCPTaskStatus> = new Set(['completed', 'failed', 'cancelled']);

/** `completed`, `failed` and `cancelled` are terminal: the task never changes again. */
export function isTerminalTaskStatus(status: MCPTaskStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export const TASKS_ERROR_CODES = {
  /** Unknown, expired or foreign task id. Also used for a principal mismatch, so existence is not revealed. */
  InvalidParams: -32602,
  InternalError: -32603,
  /** The request needs a task but the client did not declare `io.modelcontextprotocol/tasks`. */
  MissingRequiredClientCapability: -32021,
} as const;

/** How long a server keeps a task by default: 24 hours. */
export const DEFAULT_TASK_TTL_MS = 86_400_000;

/** Suggested poll interval while a task is young. */
export const DEFAULT_TASK_INITIAL_POLL_INTERVAL_MS = 2_000;

/** Suggested poll interval once a task is older than {@link DEFAULT_TASK_INITIAL_POLL_WINDOW_MS}. */
export const DEFAULT_TASK_POLL_INTERVAL_MS = 5_000;

/** How long a task counts as young for polling purposes. */
export const DEFAULT_TASK_INITIAL_POLL_WINDOW_MS = 60_000;
