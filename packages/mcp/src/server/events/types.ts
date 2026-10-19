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
  /** Decides whether an emitted event reaches a subscription with these arguments. Defaults to all. */
  match?(args: TArgs, data: TData): boolean;
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
}

/** @experimental SEP-3415 is a draft; this API may change. */
export interface MCPServerEmitOptions {
  /** Unique id clients deduplicate by. Defaults to a random UUID. */
  eventId?: string;
  /** When the event happened. Defaults to now. */
  timestamp?: string | Date;
}
