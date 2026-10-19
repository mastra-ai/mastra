import type { MastraError } from '@mastra/core/error';
import type {
  EventActiveNotificationParams,
  EventErrorNotificationParams,
  EventHeartbeatNotificationParams,
  EventNotificationParams,
  EventOccurrence,
  EventTerminatedNotificationParams,
  PollEventsRequestParams,
  PollEventsResult,
  StreamEventsRequestParams,
  SubscribeEventsRequestParams,
  SubscribeEventsResult,
  UnsubscribeEventsRequestParams,
  WebhookDeliveryStatus,
} from '../../shared/events';
import type { WebhookReceiver } from './webhook-receiver';

/**
 * One event occurrence delivered by an MCP Events subscription.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export type MCPEventOccurrence = EventOccurrence;

/**
 * How occurrences reach the client: `poll` repeats `events/poll`; `push` holds one long-lived
 * `events/stream` request open per subscription; `webhook` has the server POST each occurrence to
 * the client's `webhook.url` (registered with `events/subscribe`).
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export type MCPEventDeliveryMode = 'poll' | 'push' | 'webhook';

/**
 * Webhook delivery settings for `MCPClient`. With these set, event types whose servers offer
 * webhook delivery use it in preference to push and poll.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPClientWebhookOptions {
  /** Public `https` URL that reaches `mcp.events.handleWebhook()`. */
  url: string;
  /**
   * `whsec_` signing secret shared by every subscription. Default: a fresh random secret per
   * subscription, so one server cannot sign deliveries for another server's subscriptions.
   */
  secret?: string;
  /** Suggested subscription lifetime. `null` asks for no expiry. Default: the server's default. */
  ttlMs?: number | null;
  /** How long before `refreshBefore` to refresh. Default: the smaller of 60 seconds and 20% of the grant. */
  refreshMarginMs?: number;
}

/** Webhook settings and receiver shared by the subscriptions of one `MCPClient`. */
export interface EventsWebhookSetup {
  options: MCPClientWebhookOptions;
  receiver: WebhookReceiver;
}

/**
 * Error passed to {@link MCPEventSubscription.onError} for recoverable problems, and thrown by
 * the subscription iterator when the subscription ends. Ids:
 *
 * - `MCP_EVENTS_STREAM_ERROR` – the server reported a recoverable error on a push stream (`details.code`).
 * - `MCP_EVENTS_HEARTBEAT_TIMEOUT` – a push stream went silent; the client reopens it.
 * - `MCP_EVENTS_DELIVERY_INTERRUPTED` – a transient failure; the client retries with backoff.
 * - `MCP_EVENTS_SUBSCRIPTION_FAILED` – a non-retryable JSON-RPC error (`details.code`). Ends the subscription.
 * - `MCP_EVENTS_SUBSCRIPTION_TERMINATED` – the server terminated the subscription (`details.code`). Ends it.
 * - `MCP_EVENTS_RETRIES_EXHAUSTED` – `retry.maxAttempts` was reached. Ends the subscription.
 * - `MCP_EVENTS_BUFFER_OVERFLOW` – the consumer fell `maxBufferedEvents` behind and the oldest unread occurrences were dropped; the next one is flagged `truncated`.
 * - `MCP_EVENTS_WEBHOOK_DELIVERY_FAILING` – the server reports that it cannot deliver to the
 *   webhook URL (`details.lastError`, `details.active`). Refreshing resumes a suspended subscription.
 * - `MCP_EVENTS_WEBHOOK_UNAVAILABLE` – the server rejected webhook delivery (`details.code`, e.g. an
 *   unauthenticated connection or a full webhook subscription cap), so a subscription that did not force a mode fell back to
 *   `details.fallback`. Reported once, to the first `onError` handler.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export type MCPEventSubscriptionError = MastraError;

/**
 * Retry policy for transient failures. Delays use full jitter:
 * `random(0, min(maxDelayMs, initialDelayMs * factor ** (attempt - 1)))`.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPEventRetryOptions {
  /** Default 1000. */
  initialDelayMs?: number;
  /** Default 30000. */
  maxDelayMs?: number;
  /** Default 2. */
  factor?: number;
  /** Retries allowed after consecutive failures; the next failure ends the subscription. Default unlimited. */
  maxAttempts?: number;
}

/**
 * Options for `events.subscribe()`.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPEventSubscribeOptions {
  /**
   * Force a delivery mode. Rejects when the server does not offer it for this event, or for
   * `webhook` when the client has no `webhook` settings. Default: webhook (when configured), then
   * push, then poll.
   */
  delivery?: MCPEventDeliveryMode;
  /** Resume from a cursor you persisted earlier. Default `null` (start from now). */
  cursor?: string | null;
  /** Do not replay occurrences older than this. */
  maxAgeMs?: number;
  /** Upper bound on occurrences per `events/poll` response (poll only). */
  maxEvents?: number;
  /** Floor applied to the server's `nextPollMs`. Default 1000. */
  minPollIntervalMs?: number;
  /** Silence on a push stream after which it is reopened. Default 60000 (twice the 30s heartbeat). */
  heartbeatTimeoutMs?: number;
  /** How long to wait for `notifications/events/active` after opening a push stream. Default: the server's request timeout. */
  streamOpenTimeoutMs?: number;
  /** Number of recent `eventId`s remembered for de-duplication. Default 1000. */
  dedupWindow?: number;
  /**
   * Most occurrences held for a consumer that is not reading. When full, the oldest is dropped,
   * the next occurrence is flagged `truncated`, and `MCP_EVENTS_BUFFER_OVERFLOW` is reported.
   * Default 1000.
   */
  maxBufferedEvents?: number;
  /** Backoff for transient failures. */
  retry?: MCPEventRetryOptions;
  /** Aborting it is the same as calling `cancel()`. */
  signal?: AbortSignal;
}

/**
 * A live MCP Events subscription. Iterate it with `for await`; leaving the loop early cancels it.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPEventSubscription extends AsyncIterable<MCPEventOccurrence> {
  /** Event name. */
  readonly name: string;
  /** Subscription arguments sent with every request. */
  readonly arguments: Record<string, unknown> | undefined;
  /** Delivery mode in use. */
  readonly mode: MCPEventDeliveryMode;
  /**
   * Cursor that is safe to persist and pass back as `cursor` to resume: it never moves past an
   * occurrence that has not been yielded yet. A poll batch's cursor applies once the batch's last
   * occurrence has been yielded; heartbeat and confirmation cursors apply once every occurrence
   * buffered before them has been yielded. Persist it after handling each occurrence for
   * at-least-once processing. `null` means the server offers no replay for this subscription;
   * do not persist it.
   */
  readonly cursor: string | null;
  /**
   * Whether the server reported a gap (occurrences were skipped) right before the occurrence just
   * yielded. It turns true when the gap is reported, stays true while the first occurrence after
   * the gap is being handled, and is false again for the occurrences after it.
   */
  readonly truncated: boolean;
  /** Webhook only: the server's latest report on delivery to the webhook URL, from the last refresh. */
  readonly deliveryStatus?: WebhookDeliveryStatus;
  /** Registers a handler for recoverable errors. Returns a function that removes it. */
  onError(handler: (error: MCPEventSubscriptionError) => void): () => void;
  /** Stops delivery and releases the server-side stream. Pending iteration ends with `done`. */
  cancel(): Promise<void>;
}

/** Receives the notifications of one push stream. */
export interface EventStreamSink {
  active(params: EventActiveNotificationParams): void;
  event(params: EventNotificationParams): void;
  heartbeat(params: EventHeartbeatNotificationParams): void;
  error(params: EventErrorNotificationParams): void;
  terminated(params: EventTerminatedNotificationParams): void;
}

/** A push stream that has been confirmed with `notifications/events/active`. */
export interface EventStreamHandle {
  /** Settles when the `events/stream` request ends: resolves on a graceful close, rejects on failure. */
  readonly done: Promise<void>;
  /** Cancels the request and stops routing its notifications. */
  abort(): void;
}

/** The narrow surface of the MCP client that subscriptions drive. */
export interface EventsPort {
  poll(params: PollEventsRequestParams, signal: AbortSignal): Promise<PollEventsResult>;
  openStream(
    params: StreamEventsRequestParams,
    sink: EventStreamSink,
    options: { signal: AbortSignal; openTimeoutMs: number },
  ): Promise<EventStreamHandle>;
  /** `events/subscribe` (webhook delivery). */
  subscribe(params: SubscribeEventsRequestParams, signal: AbortSignal): Promise<SubscribeEventsResult>;
  /** `events/unsubscribe` (webhook delivery). */
  unsubscribe(params: UnsubscribeEventsRequestParams): Promise<void>;
  /** The webhook settings and receiver, when the client is configured for webhook delivery. */
  webhook(): EventsWebhookSetup | undefined;
  /** Resolves once the client is connected, reconnecting if needed. */
  ensureConnected(): Promise<void>;
  log(level: 'debug' | 'warning' | 'error', message: string, details?: Record<string, unknown>): void;
}
