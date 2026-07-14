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
  abstract publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt'>,
    options?: { localOnly?: boolean },
  ): Promise<void>;
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
   * Delete all retained state for a topic (cached history, persistent stream
   * entries, consumer groups) once no more events will be published to it.
   *
   * Called by run lifecycles (durable agents, the evented workflow engine)
   * when a run reaches a terminal state, so per-run topics don't accumulate
   * forever on transports that retain messages (e.g. Redis Streams).
   *
   * Default implementation is a no-op: transports that don't retain anything
   * per topic (e.g. plain EventEmitter delivery) have nothing to clear.
   *
   * Best-effort contract: implementations should not throw — callers invoke
   * this fire-and-forget at cleanup boundaries, so failures should be logged
   * by the implementation rather than rejected.
   *
   * @param topic - The topic whose retained state should be deleted
   */
  clearTopic(_topic: string): Promise<void> {
    return Promise.resolve();
  }

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
}

/**
 * Distributed leasing capability, separate from event delivery (`PubSub`).
 *
 * Used by the signals layer to elect a single owner across multiple
 * processes (e.g. serverless invocations) for a given resource — most
 * commonly a thread-key, where the owner is the process that will wake
 * and run the agent stream.
 *
 * Leasing is a distinct concern from pub/sub: a backend only implements
 * this when it can genuinely coordinate a lock (Redis via SET-NX, an
 * in-memory map for single-process). Backends that cannot lease simply do
 * not implement `LeaseProvider`; the signals runtime feature-detects and
 * falls back to {@link NoopLeaseProvider} (always-win / no-op), preserving
 * single-process behavior.
 */
export interface LeaseProvider {
  /**
   * Atomically try to acquire a lease on a key.
   *
   * Returns `{ acquired: true, owner }` if the caller claimed the lease,
   * or `{ acquired: false, owner }` where `owner` is the current holder
   * (so the caller can route follow-up work to them). `owner` may be
   * `undefined` if the holder could not be read (rare).
   *
   * @param key - The lease key (e.g. thread key)
   * @param owner - Identifier for the owner (e.g. runId) — used so the
   *   same owner can call `acquireLease` idempotently and renew/release.
   * @param ttlMs - Time-to-live in milliseconds for the lease
   */
  acquireLease(key: string, owner: string, ttlMs: number): Promise<{ acquired: boolean; owner?: string }>;

  /**
   * Read the current owner of a lease, or `undefined` if no lease is held.
   */
  getLeaseOwner(key: string): Promise<string | undefined>;

  /**
   * Release a lease. No-op if the caller is not the current owner
   * (implementations should atomically check ownership before releasing
   * to avoid clobbering a renewal that happened concurrently).
   */
  releaseLease(key: string, owner: string): Promise<void>;

  /**
   * Renew an existing lease owned by `owner`, extending its TTL.
   *
   * Returns `true` if the renewal succeeded (caller still owns it),
   * `false` if the lease was lost (TTL expired or another owner took it).
   */
  renewLease(key: string, owner: string, ttlMs: number): Promise<boolean>;

  /**
   * Atomically hand a held lease from `fromOwner` to `toOwner`, refreshing
   * its TTL, without ever releasing the key in between.
   *
   * This is the gap-free primitive used when one owner finishes but a
   * follow-up owner must take over the *same* lease key immediately (e.g. a
   * thread run completes and a queued follow-up run drains on the same
   * thread). A naive release-then-acquire would briefly leave the key empty,
   * letting a racing process win the freed lease and start a competing run.
   *
   * Returns `true` if `fromOwner` still held the lease and ownership moved to
   * `toOwner`; `false` if the lease was already lost (expired or taken by a
   * third owner), in which case the caller should fall back to a fresh
   * `acquireLease`.
   *
   * Backends that cannot perform this atomically must still implement it —
   * as a best-effort `releaseLease(from)` followed by `acquireLease(to)` — and
   * document that the swap is non-atomic (a racing process can win the key in
   * the gap). Keeping it required means callers have a single code path and the
   * atomicity guarantee is an explicit per-backend decision rather than a
   * silent caller-side fallback.
   */
  transferLease(key: string, fromOwner: string, toOwner: string, ttlMs: number): Promise<boolean>;
}

/**
 * Duck-typed check for whether a value implements {@link LeaseProvider}.
 *
 * Uses structural detection rather than `instanceof` so it works across
 * package boundaries (e.g. a separately-published pubsub backend resolving
 * a different copy of `@mastra/core`).
 */
export function isLeaseProvider(value: unknown): value is LeaseProvider {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return false;
  const candidate = value as Partial<LeaseProvider>;
  return (
    typeof candidate.acquireLease === 'function' &&
    typeof candidate.getLeaseOwner === 'function' &&
    typeof candidate.releaseLease === 'function' &&
    typeof candidate.renewLease === 'function' &&
    typeof candidate.transferLease === 'function'
  );
}

/**
 * Always-win / no-op {@link LeaseProvider}. Used by the signals runtime
 * when the configured pubsub does not implement `LeaseProvider` — this
 * preserves single-process behavior where every caller "wins" its own
 * lease race and release/renew are inert.
 */
export const NoopLeaseProvider: LeaseProvider = {
  acquireLease(_key: string, owner: string, _ttlMs: number): Promise<{ acquired: boolean; owner?: string }> {
    return Promise.resolve({ acquired: true, owner });
  },
  getLeaseOwner(_key: string): Promise<string | undefined> {
    return Promise.resolve(undefined);
  },
  releaseLease(_key: string, _owner: string): Promise<void> {
    return Promise.resolve();
  },
  renewLease(_key: string, _owner: string, _ttlMs: number): Promise<boolean> {
    return Promise.resolve(true);
  },
  transferLease(_key: string, _fromOwner: string, _toOwner: string, _ttlMs: number): Promise<boolean> {
    // Single-process: there is no competing holder, so the handoff always
    // "succeeds" — the next owner is free to proceed.
    return Promise.resolve(true);
  },
};
