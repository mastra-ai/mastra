import type { RequestContext } from '@mastra/core/request-context';
import type { PublicSchema } from '@mastra/core/schema';

import type { EventDeliveryMode, WebhookUrlPolicyOptions } from '../../shared/events';
import type { WebhookSubscriptionStore } from './webhook-store';
import type { WebhookTransport } from './webhook-transport';

/** Subscription arguments of an event type. @experimental SEP-3415 is a draft; this API may change. */
export type MCPServerEventArgs = Record<string, unknown>;

/** Payload (`data`) of an event occurrence. @experimental SEP-3415 is a draft; this API may change. */
export type MCPServerEventData = Record<string, unknown>;

/**
 * What a `poll` source receives for one `events/poll` request.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPServerEventPollContext<TArgs extends MCPServerEventArgs = MCPServerEventArgs> {
  /** Subscription arguments, validated against `inputSchema` when one is set. */
  arguments: TArgs;
  /** Cursor from the previous poll, or `null` to start from now (no replay). */
  cursor: string | null;
  /** Upper bound on the number of events to return. */
  maxEvents: number;
  /** The client asks not to replay events older than this many milliseconds. */
  maxAgeMs?: number;
  requestContext: RequestContext;
  /** Aborted when the client cancels the request. */
  signal: AbortSignal;
}

/**
 * What `authorize` receives when a client polls or subscribes to an event type.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPServerEventAuthorizeContext<TArgs extends MCPServerEventArgs = MCPServerEventArgs> {
  /** Subscription arguments, validated against `inputSchema` when one is set. */
  arguments: TArgs;
  /** The caller's request context, including `user` when the server maps one from the request's auth info. */
  requestContext: RequestContext;
  /** How the caller asked to receive events. */
  delivery: EventDeliveryMode;
}

/**
 * An event returned by a `poll` source. The server fills in `eventId` (random UUID) and
 * `timestamp` (now) when they are absent.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPServerPolledEvent<TData extends MCPServerEventData = MCPServerEventData> {
  data: TData;
  /**
   * Stable id of the occurrence. Clients dedupe by it across polls and reconnections, so return
   * the same id every time the same occurrence is polled (for example the upstream record id).
   */
  eventId: string;
  /** When the event occurred. Defaults to the time of the poll. */
  timestamp?: string | Date;
}

/** @experimental SEP-3415 is a draft; this API may change. */
export interface MCPServerEventPollResult<TData extends MCPServerEventData = MCPServerEventData> {
  events: MCPServerPolledEvent<TData>[];
  /** Position after the returned events, or `null` for a non-replayable source. */
  cursor: string | null;
  hasMore?: boolean;
  nextPollMs?: number;
  truncated?: boolean;
}

/**
 * Definition of one event type served by `MCPServer`.
 *
 * Without `poll`, the type is fed by `server.events.emit()` and is served over push
 * (`events/stream`) and poll (`events/poll`, from a per-type ring buffer). With `poll`, the
 * type is served over poll only, by calling `poll` for each request; it can't also be pushed,
 * and `server.events.emit()` rejects it.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPServerEventDefinition<
  TArgs extends MCPServerEventArgs = MCPServerEventArgs,
  TData extends MCPServerEventData = MCPServerEventData,
> {
  description?: string;
  /** Schema for subscription `arguments`. Advertised as JSON Schema in `events/list`. */
  inputSchema?: PublicSchema<TArgs>;
  /** Schema for event `data`. Advertised in `events/list` and enforced by `emit()`. */
  payloadSchema?: PublicSchema<TData>;
  /**
   * Decides whether an emitted event reaches a subscription with these arguments. Defaults to all.
   * The client chooses the arguments, so `match` doesn't restrict who can subscribe; use
   * `authorize` for that.
   */
  match?(args: TArgs, data: TData): boolean;
  /**
   * Decides whether the caller may receive this event type with these arguments. Runs on every
   * `events/poll` and on every `events/stream` open; returning `false` rejects the request with
   * -32024. An open stream isn't checked again until it reconnects. Defaults to allowing everyone.
   */
  authorize?(context: MCPServerEventAuthorizeContext<TArgs>): boolean | Promise<boolean>;
  /** Pull source serving `events/poll`. */
  poll?(context: MCPServerEventPollContext<TArgs>): Promise<MCPServerEventPollResult<TData>>;
  /**
   * Restricts the advertised delivery modes to this list. It only narrows: a mode the
   * definition can't serve (for example `'push'` on a type with `poll`) is dropped, and a
   * definition left with none fails at construction.
   */
  delivery?: EventDeliveryMode[];
  /** Number of emitted events retained for replay and ring-buffer polls. Defaults to 1000. */
  bufferSize?: number;
  /** `nextPollMs` suggested to clients polling the ring buffer. */
  pollIntervalMs?: number;
}

/**
 * Server-wide events settings.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPServerEventsOptions {
  /** Longest gap between messages on an `events/stream`. Defaults to 30 000 ms. */
  heartbeatIntervalMs?: number;
  /** Descriptors per `events/list` page. Defaults to 100. */
  listPageSize?: number;
  /**
   * Most `events/stream` requests this server keeps open at once, across all clients. Further
   * requests are rejected with -32025 until a stream closes. Defaults to 1024.
   */
  maxStreams?: number;
  /**
   * Enables webhook delivery (`events/subscribe`, `events/unsubscribe`) for event types fed by
   * `server.events.emit()`. Types with a `poll` source stay poll-only. Webhook subscriptions need an
   * authenticated caller, so serve the server over HTTP with authentication.
   */
  webhook?: MCPServerWebhookOptions;
}

/**
 * Webhook delivery settings.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPServerWebhookOptions {
  /** Subscription lifetimes granted for the client's `ttlMs` suggestion. */
  ttl?: {
    /** Granted when the client suggests none. Defaults to 30 minutes. */
    defaultMs?: number;
    /** Shorter suggestions are raised to this. Defaults to 60 seconds. */
    minMs?: number;
    /** Longer suggestions are lowered to this. Defaults to 24 hours. */
    maxMs?: number;
  };
  /**
   * Grant `ttlMs: null` (no expiry) when a client asks for it. Defaults to `false`, which grants
   * `ttl.maxMs` instead. No-expiry subscriptions must survive restarts, so enable this only with a
   * durable `store`.
   */
  allowNoExpiry?: boolean;
  /** Where subscriptions are kept. Defaults to an in-memory store. */
  store?: WebhookSubscriptionStore;
  /** Callback URL policy. By default only `https` URLs that resolve to public addresses are accepted. */
  url?: WebhookUrlPolicyOptions;
  /** Callback URLs that count as verified without a challenge handshake. */
  allowedUrls?: (url: URL) => boolean;
  /** How long a successful handshake verifies a `(principal, url)` pair. Defaults to 24 hours. */
  verificationTtlMs?: number;
  /** Time allowed for one POST. Defaults to 5 seconds. */
  timeoutMs?: number;
  /** Retries of one delivery after a failure. Exponential backoff with jitter. */
  retry?: {
    /** Attempts per event, including the first. Defaults to 5. */
    maxAttempts?: number;
    /** Defaults to 1 second. */
    initialDelayMs?: number;
    /** Defaults to 5 minutes. */
    maxDelayMs?: number;
    /** Time after the first attempt after which an event is abandoned. Suspended time does not count. Defaults to 15 minutes. */
    maxWindowMs?: number;
  };
  /** When delivery to an endpoint is suspended (`deliveryStatus.active: false`) until the client refreshes. */
  suspend?: {
    /** Rolling window the failure rate is measured over. Defaults to 60 minutes. */
    windowMs?: number;
    /** Attempts in the window needed before suspending. Defaults to 100. */
    minAttempts?: number;
    /** Failure ratio that suspends. Defaults to 0.95. */
    failureRate?: number;
  };
  /** Undelivered events held per subscription before the oldest are dropped and a `gap` is sent. Defaults to 1000. */
  maxPending?: number;
  /**
   * Most webhook subscriptions this process keeps, across all callers. A new subscription past
   * the limit is rejected with -32025; refreshing an existing one is not. Defaults to 1000.
   */
  maxSubscriptions?: number;
  /** Most webhook subscriptions one authenticated caller can hold. Defaults to 100. */
  maxSubscriptionsPerPrincipal?: number;
  /** How long deliveries are signed with both the old and the new secret after a rotation. Defaults to 5 minutes. */
  secretGraceMs?: number;
  /** Sends one POST. Defaults to `node:http`/`node:https`, connecting to the validated address. */
  transport?: WebhookTransport;
}

/** @experimental SEP-3415 is a draft; this API may change. */
export interface MCPServerEmitOptions {
  /** Unique id clients deduplicate by. Defaults to a random UUID. */
  eventId?: string;
  /** When the event happened. Defaults to now. */
  timestamp?: string | Date;
}
