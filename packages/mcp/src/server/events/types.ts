import type { RequestContext } from '@mastra/core/request-context';
import type { PublicSchema } from '@mastra/core/schema';

import type { EventDeliveryMode } from '../../shared/events';

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
 * An event returned by a `poll` source. The server fills in `eventId` (random UUID) and
 * `timestamp` (now) when they are absent.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPServerPolledEvent<TData extends MCPServerEventData = MCPServerEventData> {
  data: TData;
  eventId?: string;
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
 * type is served over poll by calling `poll` for each request; add `'push'` to `delivery` to
 * also stream occurrences passed to `server.events.emit()`.
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
  /** Decides whether an emitted event reaches a subscription with these arguments. Defaults to all. */
  match?(args: TArgs, data: TData): boolean;
  /** Pull source serving `events/poll`. */
  poll?(context: MCPServerEventPollContext<TArgs>): Promise<MCPServerEventPollResult<TData>>;
  /**
   * Delivery modes to advertise. Narrows the modes the definition can serve; `'push'` must be
   * listed explicitly to stream emitted events for a type that has a `poll` source.
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
}

/** @experimental SEP-3415 is a draft; this API may change. */
export interface MCPServerEmitOptions {
  /** Unique id clients deduplicate by. Defaults to a random UUID. */
  eventId?: string;
  /** When the event happened. Defaults to now. */
  timestamp?: string | Date;
}
