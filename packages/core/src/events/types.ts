export type Event = {
  type: string;
  id: string;
  // TODO: we'll want to type this better
  data: any;
  runId: string;
  createdAt: Date;
  /**
   * Sequential index for position tracking.
   * Enables efficient resume from a specific position.
   */
  index?: number;
  /**
   * How many times this message has been delivered (including this attempt).
   * Starts at 1 for the first delivery. Incremented on each nack/redelivery.
   * Not all PubSub backends support this — defaults to 1 if unknown.
   */
  deliveryAttempt?: number;
};

/**
 * Per-subscription batching policy.
 *
 * Opt-in: when omitted, subscribers receive events one at a time as today.
 * When provided, callbacks are invoked in temporally grouped runs — the
 * callback signature does not change; a batch of N events becomes N
 * consecutive callback invocations in publish order.
 */
export interface SubscribeBatchOptions {
  /** Maximum events held before forcing a flush. */
  maxSize?: number;
  /**
   * Maximum wall time (ms) the oldest event may sit in the buffer.
   * Timer starts when the buffer transitions empty → non-empty.
   */
  maxWaitMs?: number;
  /**
   * Minimum wall time (ms) between consecutive batch deliveries.
   * Even when `maxSize`/`maxWaitMs` would fire, the buffer holds until
   * this interval has elapsed since the last delivery.
   */
  minIntervalMs?: number;
  /**
   * If true for an event, the buffer flushes immediately on publish
   * (subject to `minIntervalMs`). Per-event escape hatch.
   */
  isImmediate?: (event: Event) => boolean;
  /**
   * Applied to the batch before delivery. Use to drop superseded events.
   *
   * Contract: must return a subset of its input events by **reference
   * identity**. To drop an event, omit it. Do NOT return freshly-constructed
   * `Event` objects (even with matching `id`) — the batching layer routes
   * ack/nack to the original transport handle by reference, and a
   * manufactured event has no such handle. If a coalesce returns any
   * event that wasn't in the input array by reference, the whole batch
   * is treated as a contract violation and discarded (every original
   * event is acked as dropped). If you need merged event payloads,
   * build them in the subscriber callback after delivery.
   *
   * Ordering of kept events must be preserved.
   */
  coalesce?: (events: Event[]) => Event[];
  /**
   * Maximum events the buffer may hold before overflow handling kicks in.
   * Defaults to 256. Events flagged immediate are never dropped on overflow.
   */
  maxBufferSize?: number;
  /**
   * Overflow strategy. Defaults to 'coalesce-or-drop-oldest', which runs
   * `coalesce` first (if provided) and then drops oldest if still over budget.
   */
  overflow?: 'drop-oldest' | 'drop-newest' | 'coalesce-or-drop-oldest';
}

export interface SubscribeOptions {
  /**
   * When set, subscribers with the same group compete for messages.
   * Each message is delivered to exactly one subscriber in the group.
   * When not set, behaves as fan-out (all subscribers get every message).
   */
  group?: string;
  /**
   * Opt-in batching policy. When omitted, behavior is unchanged.
   */
  batch?: SubscribeBatchOptions;
}

/**
 * Callback signature for PubSub subscribers.
 *
 * @param event - The delivered event
 * @param ack - Acknowledge successful processing for this subscription. Persistent backends may retain the event
 *              for other subscribers or replay.
 * @param nack - Negative acknowledge. Message is requeued for redelivery after a delay.
 *               Not calling either ack or nack leaves the message in-flight according to the backend's delivery
 *               policy; some backends retain it indefinitely.
 */
export type EventCallback = (
  event: Event,
  ack?: () => Promise<void>,
  nack?: () => Promise<void>,
) => void | Promise<void>;
