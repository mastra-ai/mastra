/**
 * Wire constants for the MCP Events extension (SEP-3415).
 *
 * @experimental SEP-3415 is a draft Extensions Track proposal. Names, shapes and error codes may change.
 */

/** Extension identifier used as the key under `capabilities.extensions`. */
export const EVENTS_EXTENSION_ID = 'io.modelcontextprotocol/events';

/** `_meta` key that carries the parent `events/stream` request id on push notifications. */
export const EVENTS_SUBSCRIPTION_ID_META_KEY = 'io.modelcontextprotocol/subscriptionId';

export const EVENTS_METHODS = {
  list: 'events/list',
  poll: 'events/poll',
  stream: 'events/stream',
  subscribe: 'events/subscribe',
  unsubscribe: 'events/unsubscribe',
} as const;

export const EVENTS_NOTIFICATIONS = {
  active: 'notifications/events/active',
  event: 'notifications/events/event',
  heartbeat: 'notifications/events/heartbeat',
  error: 'notifications/events/error',
  terminated: 'notifications/events/terminated',
  listChanged: 'notifications/events/list_changed',
} as const;

export const EVENT_DELIVERY_MODES = ['poll', 'push', 'webhook'] as const;

/**
 * Error codes defined by SEP-3415. They are provisional until the SEP is accepted, so callers should
 * surface them rather than branch on them beyond the documented fail-fast set.
 */
export const EVENTS_ERROR_CODES = {
  InvalidParams: -32602,
  NotFound: -32023,
  Forbidden: -32024,
  ResourceExhausted: -32025,
  Unsupported: -32026,
  CallbackEndpointError: -32027,
} as const;

/** Error codes that a client should not retry: the subscription itself is invalid. */
export const EVENTS_NON_RETRYABLE_ERROR_CODES: readonly number[] = [
  EVENTS_ERROR_CODES.InvalidParams,
  EVENTS_ERROR_CODES.NotFound,
  EVENTS_ERROR_CODES.Forbidden,
  EVENTS_ERROR_CODES.Unsupported,
];

/** Categories allowed in `deliveryStatus.lastError` and `CallbackEndpointError` `data.reason`. */
export const WEBHOOK_FAILURE_REASONS = [
  'connection_refused',
  'timeout',
  'tls_error',
  'http_4xx',
  'http_5xx',
  'challenge_failed',
] as const;

/** Headers present on every webhook delivery (Standard Webhooks plus the MCP routing header). */
export const WEBHOOK_HEADERS = {
  id: 'webhook-id',
  timestamp: 'webhook-timestamp',
  signature: 'webhook-signature',
  subscriptionId: 'x-mcp-subscription-id',
} as const;

/** Servers SHOULD send a push heartbeat at least this often. */
export const DEFAULT_EVENTS_HEARTBEAT_INTERVAL_MS = 30_000;

/** Default floor clients apply to `nextPollMs` so a misbehaving server cannot induce a tight loop. */
export const DEFAULT_MIN_POLL_INTERVAL_MS = 1_000;
