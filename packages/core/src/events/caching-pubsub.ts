import type { MastraServerCache } from '../cache/base';
import type { IMastraLogger } from '../logger';
import { isLeaseProvider, PubSub } from './pubsub';
import type { LeaseProvider } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

/**
 * Options for CachingPubSub
 */
export interface CachingPubSubOptions {
  /**
   * Optional prefix for cache keys to namespace events.
   * Defaults to 'pubsub:'.
   */
  keyPrefix?: string;
  /**
   * Optional logger for structured logging.
   * Falls back to console.error if not provided.
   */
  logger?: IMastraLogger;
  /**
   * Optional per-topic caching policy. Defaults to caching every topic.
   *
   * Returning `false` takes the same path as a `localOnly` publish: no list
   * entry, no index, no counter allocation — the event is handed straight to
   * the inner PubSub and still delivered live.
   *
   * This exists because `localOnly` is not always visible here. When a caller
   * wraps a PubSub that itself decides `localOnly` (e.g. the `mastra.pubsub`
   * proxy), the cache runs *above* that decision and never sees the flag, so
   * the policy has to be supplied at construction time instead.
   */
  shouldCache?: (topic: string) => boolean;
  /**
   * Optional bus to follow for topics this cache serves.
   *
   * Publishers that don't go through this `CachingPubSub` (e.g. the evented
   * workflow engine, which publishes agent-stream events on `mastra.pubsub`
   * from whichever worker executes a step) never hit `publish()` here, so
   * their events are neither cached nor — when `source` is a different
   * transport than `inner` — delivered to local subscribers at all. Setting
   * `source` makes this cache a follower: whenever a topic has local
   * subscribers, the cache also subscribes to `source`, assigns indices to and
   * caches events that haven't passed through a caching layer yet, and (when
   * `source` and `inner` are genuinely different transports) republishes them
   * into `inner` for live delivery. See {@link CachingPubSub.__setSource}.
   */
  source?: PubSub;
  /**
   * How the indices this instance allocates are meant to be deduplicated.
   *
   * `'watermark'` (default) matches every existing caller: the index comes
   * from this instance's own counter, so a lower index arriving after a higher
   * one is a stale frame and subscribers drop it with a single high-water mark.
   * Per-process counters can hand the same index to two processes, but an
   * event that never reaches a subscriber is not a frame this layer can
   * recover — that is the pre-existing behaviour.
   *
   * `'exact'` is for publishers whose index comes from a counter shared across
   * processes (see `MastraServerCache.supportsAtomicCounters`). Two workers can
   * allocate 5 and 6 and publish them in the other order, so a watermark would
   * drop a live frame; subscribers track exact indices instead.
   */
  indexMode?: 'watermark' | 'exact';
}

/**
 * A PubSub decorator that adds event caching and replay capabilities.
 *
 * Wraps any PubSub implementation and uses MastraServerCache to:
 * - Cache all published events per topic
 * - Enable replay of cached events for late subscribers
 *
 * This enables resumable streams - clients can disconnect and reconnect
 * without missing events.
 *
 * ## Batching
 *
 * `CachingPubSub` is transparent to `options.batch`: `subscribe()` forwards
 * the option to the inner PubSub, and `supportsNativeBatching` mirrors the
 * inner's value. Wrapping a non-native inner with `{ batch: {...} }` results
 * in unbatched delivery — use an inner that returns
 * `supportsNativeBatching === true` (e.g. `EventEmitterPubSub`) if you need
 * batched delivery.
 *
 * @example
 * ```typescript
 * import { EventEmitterPubSub, CachingPubSub } from '@mastra/core/events';
 * import { InMemoryServerCache } from '@mastra/core/cache';
 *
 * const cache = new InMemoryServerCache();
 * const pubsub = new CachingPubSub(new EventEmitterPubSub(), cache);
 *
 * // Subscribe with replay - receives cached events first, then live
 * await pubsub.subscribeWithReplay('my-topic', (event) => {
 *   console.log(event);
 * });
 * ```
 */

/**
 * True when `events` is exactly the cache list slice starting at `offset`:
 * every entry is numbered and its index is the list position it was read from.
 *
 * A list whose numbering allocation is not atomic with its append can hold
 * entries out of position, in which case `listFromTo(key, offset)` is a slice of
 * the list, not of the index range.
 */
function isContiguousFrom(events: Event[], offset: number): boolean {
  for (let i = 0; i < events.length; i++) {
    const index = events[i]?.index;
    // Unnumbered entries carry no positional claim to check against; treat the
    // slice as authoritative rather than paying for a full re-read.
    if (typeof index !== 'number') return true;
    if (index !== offset + i) return false;
  }
  return true;
}

/**
 * True when the event's sequence must be deduplicated exactly rather than with a
 * watermark. Cache entries carry `indexMode` next to their numeric `index`;
 * transport copies carry `streamSeq` instead of `index` (see `Event.streamSeq`).
 */
function isExactSequenced(event: Event): boolean {
  return event.indexMode === 'exact' || event.streamSeq !== undefined;
}

/** The sequence number of an event, whichever field carries it. */
function sequenceOf(event: Event): number | undefined {
  return isExactSequenced(event) ? (event.index ?? event.streamSeq) : event.index;
}

/**
 * The copy of `event` to hand to the transport.
 *
 * Watermark-kind events keep their numeric `index`: subscribers have always
 * read it, and dropping it would turn today's dropped-stale-frame behaviour
 * into extra deliveries. Exact-kind events instead carry `streamSeq`, so a
 * subscriber running pre-#27352 code sees no `index` and delivers the frame
 * unnumbered — the pre-change behaviour — while new code reads `streamSeq` and
 * applies exact dedupe.
 */
function transportCopy(event: Event, indexMode: 'watermark' | 'exact'): Event {
  const { index, streamSeq: _streamSeq, ...rest } = event;
  if (index === undefined) return rest;
  if (indexMode === 'exact') return { ...rest, indexMode: 'exact', streamSeq: index };
  return { ...rest, index };
}

export class CachingPubSub extends PubSub {
  private readonly keyPrefix: string;
  private readonly logger?: IMastraLogger;
  private readonly shouldCache?: (topic: string) => boolean;
  private readonly indexMode: 'watermark' | 'exact';
  /** Maps original callbacks to their wrapped versions for proper unsubscribe */
  private callbackMap = new Map<EventCallback, EventCallback>();
  /** Bus this cache follows for externally-published events. See {@link __setSource}. */
  private source?: PubSub;
  /** Per-topic follower subscriptions on {@link source}, refcounted by local subscribers. */
  private followers = new Map<string, { source: PubSub; cb: EventCallback; refs: number }>();

  constructor(
    private readonly inner: PubSub,
    private readonly cache: MastraServerCache,
    options: CachingPubSubOptions = {},
  ) {
    super();
    this.keyPrefix = options.keyPrefix ?? 'pubsub:';
    this.logger = options.logger;
    this.shouldCache = options.shouldCache;
    this.indexMode = options.indexMode ?? 'watermark';
    if (options.source) this.__setSource(options.source);
  }

  /**
   * Set (or replace) the source bus this cache follows.
   *
   * Exists separately from the constructor because the natural source is often
   * not known at construction time: a durable agent builds its `CachingPubSub`
   * lazily, but `mastra.pubsub` only becomes available at registration.
   * Replacing the source only affects topics that start being followed
   * afterwards — existing follower subscriptions stay on the bus they were
   * created against until released.
   * @internal
   */
  __setSource(source: PubSub | undefined): void {
    // Following ourselves is meaningless and hazardous: every publish on such
    // a source already flows through this.publish(), so any un-indexed event
    // the follower would observe is one publish() *deliberately* declined to
    // cache (the `localOnly` bypass, or `shouldCache`) — re-caching it would
    // resurrect the run-local cache leak (#21668). The `__self()` probe sees
    // through the `mastra.pubsub` proxy, which breaks plain reference
    // equality while still targeting this very instance (the reuse-not-
    // double-wrap configuration, #18148).
    if (source === this || source?.__self?.() === this) return;
    this.source = source;
  }

  /** Unwrap to the inner transport so aliasing checks see through this decorator. */
  override __rawBus(): PubSub {
    return this.inner.__rawBus();
  }

  get supportsNativeBatching(): boolean {
    return this.inner.supportsNativeBatching;
  }

  get supportsOffsets(): boolean {
    return true;
  }

  /**
   * Log an error message using the configured logger or console.error.
   */
  private logError(message: string, error: unknown): void {
    if (this.logger) {
      this.logger.error(message, error);
    } else {
      console.error(message, error);
    }
  }

  /**
   * Stable key used to deduplicate an event across the cache-replay and
   * live-delivery paths.
   *
   * We cannot dedup on `event.id`: `CachingPubSub.publish` assigns the id and
   * caches the event with it, but inner PubSub implementations
   * (EventEmitterPubSub, UnixSocketPubSub, …) regenerate `id` inside their own
   * `publish`, so the cached copy and the live copy of the SAME publish carry
   * different ids. The sequential `index` is assigned here and is preserved by
   * every inner implementation, so it matches across both paths. Events without
   * an index are never cached (see `publish`), so they can't be replay/live
   * duplicated — falling back to `id` for them is safe.
   */
  private dedupKey(event: Event): string {
    if (isExactSequenced(event)) return `s:${event.index ?? event.streamSeq}`;
    return event.index !== undefined ? `i:${event.index}` : `id:${event.id}`;
  }

  /**
   * Get the cache key for a topic's event list
   */
  private getCacheKey(topic: string): string {
    return `${this.keyPrefix}${topic}`;
  }

  /**
   * Get the cache key for a topic's index counter
   */
  private getCounterKey(topic: string): string {
    return `${this.keyPrefix}${topic}:counter`;
  }

  /**
   * Whether {@link source} is backed by the same transport as {@link inner}.
   *
   * When they alias (e.g. the test harness passes one `EventEmitterPubSub`
   * both to the agent and to `Mastra`, or the agent adopted `mastra.pubsub`
   * as its inner bus), local subscribers already receive source-published
   * events through their inner subscription — the follower must then only
   * cache, never republish, or every event would be delivered twice.
   */
  private isSourceAliased(source: PubSub): boolean {
    return source.__rawBus() === this.inner.__rawBus();
  }

  /**
   * Whether this cache already holds the frame published under {@link sequence}.
   *
   * Entries are appended in allocation order, so a sequence is also its list
   * position and one positional read answers it. Used to recognise a frame that
   * another caching tier over the same cache already stored, which must not be
   * stored a second time under a fresh index.
   */
  private async holdsSequence(topic: string, sequence: number): Promise<boolean> {
    try {
      const [entry] = (await this.cache.listFromTo(this.getCacheKey(topic), sequence, sequence)) as Event[];
      return entry?.index === sequence;
    } catch {
      // An unreadable cache falls back to storing the copy, as before.
      return false;
    }
  }

  /**
   * Start following {@link source} for a topic (idempotent, refcounted).
   * Called on every local subscription entry point; released on unsubscribe
   * and torn down on {@link clearTopic}.
   *
   * The follower's contract:
   * - On an aliased source, events that carry a transport sequence (`index` for
   *   watermark-kind events, `streamSeq` for exact-kind ones) are this cache's
   *   own publish echo (or its own republish) — ack and ignore them. This is
   *   both the dedup and the republish loop guard.
   * - On a non-aliased source, an `index` means the event passed through a
   *   *foreign* caching tier (e.g. a user-supplied `CachingPubSub` handed to
   *   `new Mastra({ pubsub })` while this agent runs its own cache tier).
   *   That tier's cache is not necessarily the one this instance replays
   *   from: if this cache already holds the frame at that sequence (the two
   *   tiers share one `serverCache` but not a bus), re-caching would put the
   *   same frame in the history twice, so the follower only republishes it.
   *   Otherwise the event is treated like an un-indexed one: cached here under
   *   a fresh index (replacing the foreign index) and republished into
   *   `inner`. Dropping it instead would lose the event for local subscribers
   *   entirely — the exact stream-loss failure `source` following exists to
   *   prevent (#20646).
   * - Un-indexed events were published directly on the source bus (e.g. by
   *   the evented workflow engine, possibly from another process). Assign an
   *   index, cache them (subject to `shouldCache`), and — only when source and
   *   inner are different transports — republish the indexed copy into `inner`
   *   so local subscribers receive it live. On an aliased bus the original
   *   delivery already reached them.
   *
   * Subscribes with `startFrom: 'latest'`: the follower's job is to mirror
   * live traffic into the cache, not to re-ingest a persistent backend's
   * retained history — re-reading from 'earliest' after a process restart
   * would re-cache already-cached events under fresh indices.
   */
  private async retainFollower(topic: string): Promise<void> {
    const source = this.source;
    if (!source) return;
    const existing = this.followers.get(topic);
    if (existing) {
      existing.refs++;
      return;
    }

    const followerCb: EventCallback = async (event, ack) => {
      try {
        const aliased = this.isSourceAliased(source);
        // Any transport sequence means this event already passed through a
        // caching tier — `index` for watermark-kind events, `streamSeq` for
        // exact-kind ones. On an aliased bus that is this cache's own publish
        // echo (or its own republish): ack and ignore.
        if ((event.index !== undefined || event.streamSeq !== undefined) && aliased) {
          return await ack?.();
        }
        let outbound: Event = event;
        // An exact-sequenced frame names the index it was cached under by its
        // publisher. When that entry is in this same cache, the frame is already
        // in the history: store it again and every replay would carry it twice.
        const alreadyCached = event.streamSeq !== undefined && (await this.holdsSequence(topic, event.streamSeq));
        if (!alreadyCached && this.shouldCache?.(topic) !== false) {
          // Same single-round-trip op as publish() (#22477): the follower sits
          // on the identical per-chunk hot path for engine-originated events.
          // The stored copy carries the allocated index, preserving the
          // "indexed ⇒ already cached" dedup contract. Strip any sequence the
          // event already carried: a foreign tier's numbering must not be
          // mistaken for one of ours.
          const { index: _foreignIndex, streamSeq: _foreignSeq, indexMode: _foreignMode, ...body } = event;
          try {
            const index = await this.cache.listPushIndexed(this.getCacheKey(topic), this.getCounterKey(topic), body);
            outbound = transportCopy(
              { ...body, index, ...(this.indexMode === 'exact' ? { indexMode: 'exact' as const } : {}) },
              this.indexMode,
            );
          } catch (error) {
            this.logError(`[CachingPubSub] Failed to cache followed event for ${topic}`, error);
          }
        }
        if (!aliased) {
          // Inner implementations regenerate `id` but preserve the sequence,
          // same as the publish() path — live and cached copies dedup by it.
          await this.inner.publish(topic, outbound);
        }
        await ack?.();
      } catch (error) {
        this.logError(`[CachingPubSub] Follower failed for ${topic}`, error);
        await ack?.();
      }
    };

    // Record synchronously so concurrent retains don't double-subscribe.
    const entry = { source, cb: followerCb, refs: 1 };
    this.followers.set(topic, entry);
    try {
      await source.subscribe(topic, followerCb, { startFrom: 'latest' });
    } catch (error) {
      this.followers.delete(topic);
      this.logError(`[CachingPubSub] Failed to follow source for ${topic}`, error);
    }
  }

  /** Drop one follower reference for a topic; unsubscribe from source at zero. */
  private async releaseFollower(topic: string): Promise<void> {
    const entry = this.followers.get(topic);
    if (!entry) return;
    entry.refs--;
    if (entry.refs > 0) return;
    this.followers.delete(topic);
    await entry.source.unsubscribe(topic, entry.cb).catch?.(() => {});
  }

  /** Tear down a topic's follower unconditionally (stream completion). */
  private async stopFollowing(topic: string): Promise<void> {
    const entry = this.followers.get(topic);
    if (!entry) return;
    this.followers.delete(topic);
    await entry.source.unsubscribe(topic, entry.cb).catch?.(() => {});
  }

  /**
   * Publish an event to a topic.
   * The event is cached with a sequential index before being published to the inner PubSub.
   *
   * Uses atomic increment for index assignment to prevent race conditions
   * when multiple events are published concurrently.
   *
   * `localOnly` events bypass the cache entirely — no list entry, no index, no
   * counter allocation — and are handed straight to the inner PubSub. They are
   * never relayed to other instances, so a shared replay cache can have no
   * reader for them; caching them only grows the store without bound (some
   * payloads, e.g. `workflow.events.v2.*` watch events carrying cumulative step
   * results, are multiple megabytes each). Consumers of `localOnly` topics
   * subscribe live and never replay, and every downstream `index` check is
   * guarded for absence, so dropping the index is safe.
   *
   * Topics rejected by the `shouldCache` option take the exact same path, for
   * callers whose `localOnly` decision is made below this layer.
   */
  async publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt' | 'index'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    if (options?.localOnly || this.shouldCache?.(topic) === false) {
      const fullEvent: Event = {
        ...event,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };
      await this.inner.publish(topic, fullEvent, options);
      return;
    }

    const cacheKey = this.getCacheKey(topic);
    const counterKey = this.getCounterKey(topic);

    const baseEvent: Omit<Event, 'index'> = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      // Only stamped for exact mode: the default watermark path stays
      // byte-identical to what every existing deployment publishes.
      ...(this.indexMode === 'exact' ? { indexMode: 'exact' as const } : {}),
    };

    // Cache BEFORE live publish so late-joining observers never miss events.
    // Index allocation and the list append happen in one cache operation so
    // network-backed caches can do it in a single round-trip (issue #22477).
    let index: number | undefined;
    try {
      index = await this.cache.listPushIndexed(cacheKey, counterKey, baseEvent);
    } catch (error) {
      this.logError(`[CachingPubSub] Failed to cache event for ${topic}`, error);
    }

    // On cache failure leave `index` undefined rather than defaulting to 0:
    // downstream consumers that key off `index` (e.g. replay-from-offset)
    // would otherwise see colliding indices across failed publishes.
    const fullEvent: Event = {
      ...baseEvent,
      ...(index !== undefined ? { index } : {}),
    };

    // Always publish to inner PubSub — cache failure must not block live delivery.
    // Exact-mode frames go out as `streamSeq` so pre-#27352 subscribers keep
    // delivering them as unnumbered frames instead of dropping them by watermark.
    await this.inner.publish(topic, transportCopy(fullEvent, this.indexMode), options);
  }

  /**
   * Subscribe to live events on a topic (no replay).
   */
  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    await this.retainFollower(topic);
    await this.inner.subscribe(topic, cb, options);
  }

  /**
   * Subscribe to a topic with automatic replay of cached events.
   * Delegates to {@link subscribeFromOffset} with offset 0.
   */
  async subscribeWithReplay(topic: string, cb: EventCallback): Promise<void> {
    return this.subscribeFromOffset(topic, 0, cb);
  }

  /**
   * Subscribe to a topic with replay starting from a specific index.
   * More efficient than full replay when the client knows their last position.
   *
   * Order of operations:
   * 1. Subscribe to live events FIRST — buffer deliveries during bootstrap
   * 2. Fetch and deliver cached history in order
   * 3. Drain the buffer, skipping events already delivered via history
   * 4. Switch to passthrough with per-discipline dedupe (watermark or exact)
   *
   * @param topic - The topic to subscribe to
   * @param offset - Start replaying from this index (0-based)
   * @param cb - Callback invoked for each event
   */
  async subscribeFromOffset(topic: string, offset: number, cb: EventCallback): Promise<void> {
    // Follow the source (if any) before attaching locally: events the source
    // delivers between now and the live subscription below land in the cache
    // and are picked up by the history fetch.
    await this.retainFollower(topic);

    // --- Phase 1: subscribe live, buffer everything during bootstrap ---
    let bootstrapping = true;
    const buffer: Array<{
      event: Event;
      ack?: Parameters<EventCallback>[1];
      nack?: Parameters<EventCallback>[2];
    }> = [];

    // Dedupe state is kept per discipline, because the two answer different
    // questions about a lower index that arrives late.
    //
    // Watermark (default): the index comes from one publisher's own counter, so
    // a lower index after a higher one is a stale frame from a discarded
    // attempt — the pre-#27352 behaviour, unchanged.
    let lastDelivered = offset - 1;

    // Exact: `floor` is the highest index such that every index at or below it
    // has been delivered; `delivered` holds the holes above it. A single
    // high-water mark would drop a live frame — two processes sharing an atomic
    // counter can allocate 5 and 6 and have them reach the transport as 6 then
    // 5 — so indices above the floor are tracked individually and delivered in
    // arrival order. The set holds only holes; if it ever fills, eviction can
    // re-deliver an event but never drop one.
    let floor = offset - 1;
    const delivered = new Set<number>();
    const MAX_DELIVERED_INDICES = 10_000;
    const markExactDelivered = (seq: number) => {
      delivered.add(seq);
      while (delivered.has(floor + 1)) {
        delivered.delete(floor + 1);
        floor += 1;
      }
      if (delivered.size > MAX_DELIVERED_INDICES) {
        const oldest = delivered.values().next();
        if (!oldest.done) delivered.delete(oldest.value);
      }
    };

    /** Record an event as delivered under the discipline its publisher used. */
    const markDelivered = (event: Event) => {
      const seq = sequenceOf(event);
      if (seq === undefined) return;
      if (isExactSequenced(event)) markExactDelivered(seq);
      else lastDelivered = Math.max(lastDelivered, seq);
    };

    /**
     * Whether an already-delivered event is a duplicate under its own
     * discipline. Nack-redeliveries are always passed through: they carry the
     * same sequence but `deliveryAttempt > 1`, and the consumer must see them
     * to retry processing.
     */
    const isDuplicate = (event: Event, isRetry: boolean): boolean => {
      if (isRetry) return false;
      const seq = sequenceOf(event);
      if (seq === undefined) return false;
      return isExactSequenced(event) ? seq <= floor || delivered.has(seq) : seq <= lastDelivered;
    };

    // `seen` records the index-based dedup key AND the event id. The id matters
    // in two places: on an aliased source bus the follower caches an indexed
    // COPY of an event whose original live delivery carries no index, so the
    // two only correlate by id (same emitter delivery → same id); and when
    // numbering is unavailable (an unshared cache) retained transport copies
    // arrive unnumbered and are only identifiable by id.
    const seen = new Set<string>();
    const MAX_SEEN_IDS = 10_000;
    const rememberId = (id: string) => {
      seen.add(`id:${id}`);
      if (seen.size > MAX_SEEN_IDS) {
        for (const key of seen) {
          if (key.startsWith('id:')) {
            seen.delete(key);
            break;
          }
        }
      }
    };

    const wrappedCb: EventCallback = (event, ack, nack) => {
      // Drop events strictly before the requested offset on the live path.
      // Dropped deliveries are still acknowledged: the consumer will never see
      // them, so leaving them unacknowledged would strand them on the backend.
      const liveSeq = sequenceOf(event);
      if (liveSeq !== undefined && liveSeq < offset) {
        return ack?.();
      }

      if (bootstrapping) {
        buffer.push({ event, ack, nack });
        return;
      }

      // Steady-state: skip events we already delivered via history or buffer drain.
      const isRetry = typeof event.deliveryAttempt === 'number' && event.deliveryAttempt > 1;
      if (liveSeq !== undefined) {
        if (isDuplicate(event, isRetry)) {
          // Already delivered, possibly out of order. Acknowledge the duplicate
          // so it doesn't stay pending on the backend.
          return ack?.();
        }
        markDelivered(event);
      } else if (event.id) {
        // Unnumbered publisher: the sequence checks above can't recognise
        // duplicates, so fall back to the id the event was cached with — a
        // retained transport replays the stored copy, which keeps that id.
        if (!isRetry && seen.has(`id:${event.id}`)) return ack?.();
        rememberId(event.id);
      }
      // Hand the consumer's outcome back to the backend so it can ack or nack.
      return cb(event, ack, nack);
    };

    this.callbackMap.set(cb, wrappedCb);
    // Plain subscribe: replay is served from the cache below. Retaining
    // transports (Redis Streams, …) replay from `startFrom: 'earliest'` by
    // default, which is deliberate — their retained copies now carry the index
    // they were published with, so the offset and dedupe checks below reconcile
    // them with the cache instead of discarding a prefix an empty cache still
    // needs after a restart.
    await this.inner.subscribe(topic, wrappedCb);

    try {
      // --- Phase 2: fetch and deliver cached history ---
      // Seed the ids of the prefix the caller skipped, without delivering it.
      // A retaining transport replays its copies of those events, and once
      // numbering is unavailable they carry no index for the offset filter to
      // compare — their id is the only stable correlation, and it only exists in
      // the entries the cache itself holds.
      if (offset > 0) {
        const skipped = (await this.cache.listFromTo(this.getCacheKey(topic), 0, offset - 1)) as Event[];
        for (const event of skipped) {
          if (event.id) rememberId(event.id);
        }
      }
      const history = await this.getHistory(topic, offset);
      for (const event of history) {
        seen.add(this.dedupKey(event));
        if (event.id) rememberId(event.id);
        markDelivered(event);
        // Awaited so history is delivered in order before the buffer drain.
        // History comes from storage, not the transport, so there is nothing
        // to acknowledge.
        await cb(event);
      }

      // --- Phase 3: drain buffer, suppressing duplicates history already covered ---
      for (const { event, ack, nack } of buffer) {
        if (seen.has(this.dedupKey(event)) || (event.id && seen.has(`id:${event.id}`))) {
          // Acknowledge the suppressed duplicate so it doesn't stay pending.
          await ack?.();
          continue;
        }
        seen.add(this.dedupKey(event));
        if (event.id) rememberId(event.id);
        markDelivered(event);
        // The consumer settles these itself through the ack/nack it was handed
        // on the live path. Awaited so a rejection can still reach nack, which
        // the backend would otherwise have routed.
        try {
          await cb(event, ack, nack);
        } catch {
          await nack?.();
        }
      }

      // --- Phase 4: flip to passthrough ---
      bootstrapping = false;
      buffer.length = 0;
    } catch (error) {
      // Rollback: unsubscribe wrappedCb so it doesn't strand in bootstrap mode
      this.callbackMap.delete(cb);
      await this.inner.unsubscribe(topic, wrappedCb).catch(() => {});
      await this.releaseFollower(topic);
      throw error;
    }
  }

  /**
   * Unsubscribe from a topic.
   */
  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const wrappedCb = this.callbackMap.get(cb) ?? cb;
    this.callbackMap.delete(cb);
    await this.inner.unsubscribe(topic, wrappedCb);
    await this.releaseFollower(topic);
  }

  /**
   * Get historical events for a topic from cache.
   */
  async getHistory(topic: string, offset: number = 0): Promise<Event[]> {
    const cacheKey = this.getCacheKey(topic);
    let events = (await this.cache.listFromTo(cacheKey, offset)) as Event[];

    // An empty slice at a non-zero offset proves nothing: it is what a list that
    // has legitimately ended looks like, and also what a list that expired
    // mid-run and restarted at a non-zero index looks like (the index counter
    // outlives the list). Only the second case has events to deliver, and its
    // first entry gives it away.
    if (events.length === 0 && offset > 0) {
      const head = (await this.cache.listFromTo(cacheKey, 0, 0)) as Event[];
      if (head.length > 0 && head[0]?.index !== 0) {
        events = (await this.cache.listFromTo(cacheKey, 0)) as Event[];
      }
    }

    if (isContiguousFrom(events, offset)) return events;

    // List position and `index` disagree, so the slice is not "events from
    // `offset`": a cache whose index allocation and append are not one atomic
    // step (two publishers can allocate 5 and 6 and push them in the other
    // order) leaves entries out of position. Re-read the whole history and order
    // it by index. Re-delivering is recoverable by the subscriber's dedupe;
    // dropping an event is not.
    const all = (await this.cache.listFromTo(cacheKey, 0)) as Event[];
    return all
      .filter(event => typeof event.index !== 'number' || event.index >= offset)
      .sort((a, b) => {
        if (typeof a.index !== 'number' || typeof b.index !== 'number') return 0;
        return a.index - b.index;
      });
  }

  /**
   * Flush any pending operations on the inner PubSub.
   */
  async flush(): Promise<void> {
    await this.inner.flush();
  }

  /**
   * Expose the inner's {@link LeaseProvider} when it has one, otherwise
   * `undefined`. Leasing is a capability of the underlying backend
   * (e.g. Redis), not of the caching decorator itself — so rather than
   * unconditionally declaring lease methods (which would make
   * {@link isLeaseProvider} report `true` even when the inner can't
   * coordinate a lock), we surface the inner's capability directly. The
   * signals runtime unwraps this so wrapping with caching preserves real
   * distributed lease semantics without faking them.
   */
  getLeaseProvider(): LeaseProvider | undefined {
    return isLeaseProvider(this.inner) ? this.inner : undefined;
  }

  /**
   * Clear cached events for a specific topic (and the index counter), and
   * forward the clear to the inner transport.
   *
   * Call this when a stream completes to free memory. The forward matters for
   * persistent inner transports (e.g. Redis Streams): without it, wrapping a
   * pubsub in `CachingPubSub` silently turns `clearTopic` into a cache-only
   * no-op and the inner stream leaks forever.
   */
  override async clearTopic(topic: string): Promise<void> {
    const cacheKey = this.getCacheKey(topic);
    const counterKey = this.getCounterKey(topic);
    try {
      // Stop mirroring the source first — a follower running past the clear
      // would repopulate the cache the caller is trying to free.
      await this.stopFollowing(topic);
      await Promise.all([this.cache.delete(cacheKey), this.cache.delete(counterKey), this.inner.clearTopic(topic)]);
    } catch (error) {
      // Honor the base-class contract: clearTopic is best-effort and callers
      // invoke it fire-and-forget, so a cache failure must not become an
      // unhandled rejection. A failed delete means retained state may leak
      // until the transport-level TTL backstop, so make it visible.
      this.logError(`[CachingPubSub] Failed to clear topic ${topic}`, error);
    }
  }

  /** Forward run trims to the inner transport; the per-process cache is left to its own bounds. */
  override async trimTopic(topic: string, options: { runId: string; producedBefore?: number }): Promise<void> {
    try {
      await this.inner.trimTopic(topic, options);
    } catch (error) {
      this.logError(`[CachingPubSub] Failed to trim topic ${topic}`, error);
    }
  }

  /**
   * Get the inner PubSub instance.
   * Useful for accessing implementation-specific methods like close().
   */
  getInner(): PubSub {
    return this.inner;
  }
}

/**
 * Factory function to wrap a PubSub with caching capabilities.
 *
 * @example
 * ```typescript
 * import { withCaching, EventEmitterPubSub } from '@mastra/core/events';
 * import { InMemoryServerCache } from '@mastra/core/cache';
 *
 * const cache = new InMemoryServerCache();
 * const pubsub = withCaching(new EventEmitterPubSub(), cache);
 * ```
 */
export function withCaching(pubsub: PubSub, cache: MastraServerCache, options?: CachingPubSubOptions): CachingPubSub {
  return new CachingPubSub(pubsub, cache, options);
}
