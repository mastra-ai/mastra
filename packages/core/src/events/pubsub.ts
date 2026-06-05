import type { Event, EventCallback, SubscribeOptions } from './types';

/**
 * Delivery model for a PubSub implementation.
 *
 * - `pull`: consumers actively read from the broker (e.g. Redis Streams
 *   XREADGROUP, GCP Pub/Sub streamingPull, SQS ReceiveMessage). Mastra runs
 *   a long-lived `OrchestrationWorker` that owns a subscription loop.
 *
 * - `push`: events arrive without the consumer asking — either in-process
 *   (EventEmitter dispatching to a registered listener) or out-of-process
 *   (the broker POSTs to an HTTP endpoint, e.g. GCP Pub/Sub push, SNS,
 *   EventBridge). Mastra wires the workflow handler directly to the pubsub
 *   for in-process push, or relies on `POST /api/workers/events` for
 *   broker push delivered over HTTP.
 */
export type PubSubDeliveryMode = 'pull' | 'push';

export abstract class PubSub {
  abstract publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void>;
  abstract subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void>;
  abstract unsubscribe(topic: string, cb: EventCallback): Promise<void>;
  /**
   * Drain any buffered or in-flight deliveries before resolving.
   *
   * Best-effort: a `flush()` that resolves successfully does not guarantee
   * every subscriber callback succeeded — implementations surface per-event
   * delivery errors via their configured logger rather than re-throwing,
   * so a single failed callback does not mask later cleanup work.
   */
  abstract flush(): Promise<void>;

  /**
   * Delivery modes this PubSub implementation supports.
   *
   * Defaults to `['pull']` for backward compatibility — third-party
   * implementations that don't override this property are treated as
   * pull-mode, which preserves today's behavior.
   *
   * Implementations that deliver events without an active read loop (e.g.
   * EventEmitter, GCP Pub/Sub push subscriptions) should declare `'push'`.
   * Implementations that support both modes should declare both.
   */
  get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['pull'];
  }

  /**
   * Whether this implementation honors `options.batch` on `subscribe()`
   * natively. Defaults to `false`.
   *
   * Implementations that integrate batching internally (e.g. against their
   * own broker retention or via an `AckHandleBuffer`) override this getter
   * and return `true`.
   */
  get supportsNativeBatching(): boolean {
    return false;
  }

  /**
   * Get historical events for a topic.
   * Default implementation returns empty array (no history support).
   * Override in implementations that support event caching.
   *
   * @param topic - The topic to get history for
   * @param offset - Starting index (0-based), defaults to 0
   * @returns Array of events from the specified index
   */
  getHistory(_topic: string, _offset?: number): Promise<Event[]> {
    return Promise.resolve([]);
  }

  /**
   * Subscribe to a topic with automatic replay of cached events.
   * First replays any cached history, then subscribes to live events.
   * Default implementation falls back to regular subscribe (no replay).
   * Override in implementations that support event caching.
   *
   * @param topic - The topic to subscribe to
   * @param cb - Callback invoked for each event (both cached and live)
   */
  subscribeWithReplay(topic: string, cb: EventCallback): Promise<void> {
    return this.subscribe(topic, cb);
  }

  /**
   * Subscribe to a topic with replay starting from a specific index.
   * This is more efficient than full replay when the client knows their last position.
   * Default implementation falls back to subscribeWithReplay (full replay).
   * Override in implementations that support indexed event caching.
   *
   * @param topic - The topic to subscribe to
   * @param offset - Start replaying from this index (0-based)
   * @param cb - Callback invoked for each event
   */
  subscribeFromOffset(topic: string, _offset: number, cb: EventCallback): Promise<void> {
    return this.subscribeWithReplay(topic, cb);
  }

  /**
   * Atomically try to claim a reservation for a key.
   *
   * Used by the signals layer to elect a single owner across multiple
   * processes (e.g. serverless invocations) for a given resource — most
   * commonly a thread-key, where the owner is the process that will wake
   * and run the agent stream.
   *
   * Returns `{ acquired: true, owner }` if the caller claimed the
   * reservation, or `{ acquired: false, owner }` where `owner` is the
   * current holder (so the caller can route follow-up work to them).
   * `owner` may be `undefined` if the holder could not be read (rare).
   *
   * Default implementation returns `acquired: true` — i.e. single-process
   * pubsub implementations always "win" their own race, preserving
   * today's behavior. Distributed implementations (Redis, etc.) override
   * with atomic SET-NX semantics.
   *
   * @param key - The reservation key (e.g. thread key)
   * @param owner - Identifier for the owner (e.g. runId) — used so the
   *   same owner can call `tryReserve` idempotently and renew/release.
   * @param ttlMs - Time-to-live in milliseconds for the reservation
   */
  tryReserve(_key: string, owner: string, _ttlMs: number): Promise<{ acquired: boolean; owner?: string }> {
    return Promise.resolve({ acquired: true, owner });
  }

  /**
   * Read the current owner of a reservation, or `undefined` if no
   * reservation is held.
   *
   * Default implementation returns `undefined`.
   */
  getReservation(_key: string): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  /**
   * Release a reservation. No-op if the caller is not the current owner
   * (implementations should atomically check ownership before releasing
   * to avoid clobbering a renewal that happened concurrently).
   *
   * Default implementation is a no-op.
   */
  releaseReservation(_key: string, _owner: string): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Renew an existing reservation owned by `owner`, extending its TTL.
   *
   * Returns `true` if the renewal succeeded (caller still owns it),
   * `false` if the reservation was lost (TTL expired or another owner
   * took it).
   *
   * Default implementation returns `true`.
   */
  renewReservation(_key: string, _owner: string, _ttlMs: number): Promise<boolean> {
    return Promise.resolve(true);
  }
}
