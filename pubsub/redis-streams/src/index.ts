import { randomUUID } from 'node:crypto';
import { PubSub } from '@mastra/core/events';
import type { Event, EventCallback, LeaseProvider, PubSubDeliveryMode, SubscribeOptions } from '@mastra/core/events';
import { createClient } from 'redis';
import type { RedisClientOptions, RedisClientType } from 'redis';

/**
 * Flatten an error into searchable text. node-redis MULTI failures throw a
 * `MultiErrorReply` whose own message is just "N commands failed…" — the real
 * per-command errors (e.g. BUSYGROUP) live in `err.replies`, so those are
 * folded in too.
 */
function errorText(err: unknown): string {
  const parts: string[] = [err instanceof Error ? err.message : String(err)];
  if (err instanceof Error && 'replies' in err && Array.isArray((err as { replies?: unknown[] }).replies)) {
    parts.push(...(err as { replies: unknown[] }).replies.map(r => String(r)));
  }
  return parts.join('; ');
}

/**
 * Mastra PubSub backed by Redis Streams.
 *
 * - Each topic maps to a Redis stream key `<prefix>:<topic>`.
 * - Subscriptions with `options.group` use a real Redis consumer group, so
 *   competing subscribers in the same group share the work (round-robin).
 * - Subscriptions without a group create a private per-subscriber consumer
 *   group, so they get fan-out semantics (every subscriber sees every event).
 * - Nack triggers redelivery by re-publishing the event with an incremented
 *   `deliveryAttempt` field, then XACK-ing the original. This trades strict
 *   FIFO ordering on retry for a simple, reliable redelivery path.
 */
export interface RedisStreamsPubSubConfig {
  url?: string;
  keyPrefix?: string;
  blockMs?: number;
  redisOptions?: RedisClientOptions;
  /**
   * Approximate maximum number of entries kept per stream. On every publish we
   * issue MAXLEN ~ N which lets Redis trim opportunistically. Defaults to
   * 10_000 — set to 0 to disable trimming.
   */
  maxStreamLength?: number;
  /**
   * Idle expiry (in ms): a sliding TTL refreshed on every write to the stream
   * (publish, nack retry, group re-creation). Each write resets it, so an
   * actively-used stream never expires mid-flight; a stream left idle for the
   * full duration is deleted by Redis automatically.
   *
   * This is a BACKSTOP, not the primary cleanup. Normal cleanup is explicit:
   * `clearTopic` deletes a topic's stream the moment its lifecycle ends. This
   * option only bounds memory for streams that never reach a `clearTopic` call
   * — e.g. a run that crashed before cleanup — so they don't linger forever.
   *
   * Defaults to 0 (disabled) to preserve existing behavior.
   */
  streamIdleTtlMs?: number;
  /**
   * How often (in ms) each subscription runs XAUTOCLAIM to recover messages
   * that an earlier consumer in the group read but never acked. Defaults to
   * 30_000 ms. Set to 0 to disable.
   */
  reclaimIntervalMs?: number;
  /**
   * Minimum idle time (in ms) before a pending message is eligible for
   * reclaim. Should be much larger than typical in-flight processing time to
   * avoid double-delivery. Defaults to 60_000 ms.
   */
  reclaimIdleMs?: number;
  /**
   * Maximum number of times a single event will be redelivered via nack
   * before it is dropped (acked without republish). Defaults to 5. Set to
   * `Infinity` to disable the cap (events redeliver forever on every nack).
   *
   * `0` is treated as `Infinity` with a one-time warn for back-compat;
   * prefer `Infinity` to disable the cap explicitly.
   */
  maxDeliveryAttempts?: number;
  /**
   * Optional logger for diagnostics. When omitted, suppressed errors
   * (BUSYGROUP, malformed payloads, connection-close races) are swallowed
   * silently. When provided, those paths emit `debug`/`warn` entries so
   * operators can see what's happening without noise on the happy path.
   */
  logger?: { debug?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void };
}

export class RedisStreamsPubSub extends PubSub implements LeaseProvider {
  // Redis Streams is a pull transport: consumers issue XREADGROUP to read
  // events. Mastra reads this to know an OrchestrationWorker is required.
  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['pull'];
  }

  #writeClient: RedisClientType;
  #connectOptions: RedisClientOptions;
  #keyPrefix: string;
  #blockMs: number;
  #maxStreamLength: number;
  #streamIdleTtlMs: number;
  #reclaimIntervalMs: number;
  #reclaimIdleMs: number;
  #maxDeliveryAttempts: number;
  #logger?: RedisStreamsPubSubConfig['logger'];
  // Keyed by `${topic}::${cbId}` so the same callback can be subscribed to
  // multiple topics independently. Without the topic in the key,
  // unsubscribe(otherTopic, cb) would tear down the wrong subscription.
  #subscriptions: Map<string, Subscription> = new Map();
  #cbIds: WeakMap<EventCallback, string> = new WeakMap();
  #pendingPublishes: Set<Promise<unknown>> = new Set();
  // `localOnly` publishes bypass Redis entirely so values carrying live
  // methods (e.g. `MastraModelOutput` returned from an evented agent run via
  // `workflows-finish`) survive intact. Mirrors the same contract honored by
  // `UnixSocketPubSub` so consumers like `Mastra.__registerInternalWorkflow`
  // get consistent semantics across transports.
  #localCallbacks: Map<string, Set<EventCallback>> = new Map();
  #closed = false;

  constructor(options: RedisStreamsPubSubConfig = {}) {
    super();
    const url = options.url ?? options.redisOptions?.url ?? 'redis://localhost:6379';
    this.#connectOptions = { ...options.redisOptions, url };
    this.#writeClient = createClient(this.#connectOptions) as RedisClientType;
    this.#logger = options.logger;
    this.#attachErrorLogger(this.#writeClient, 'write');
    this.#keyPrefix = options.keyPrefix ?? 'mastra:topic';
    this.#blockMs = options.blockMs ?? 1000;
    this.#maxStreamLength = options.maxStreamLength ?? 10_000;
    const ttl = options.streamIdleTtlMs ?? 0;
    // Must be a non-negative integer: node-redis serializes the PEXPIRE arg with
    // toString(), and Redis rejects a non-integer/Infinity ('value is not an
    // integer or out of range'). Without this guard a bad value would poison
    // every publish MULTI and be silently swallowed on the nack/recovery
    // paths, so fail fast at construction instead.
    if (!Number.isInteger(ttl) || ttl < 0) {
      throw new Error(`redis-streams: streamIdleTtlMs must be a non-negative integer (milliseconds), got ${ttl}`);
    }
    this.#streamIdleTtlMs = ttl;
    this.#reclaimIntervalMs = options.reclaimIntervalMs ?? 30_000;
    this.#reclaimIdleMs = options.reclaimIdleMs ?? 60_000;
    const cap = options.maxDeliveryAttempts ?? 5;
    if (cap === 0) {
      options.logger?.warn?.(
        'redis-streams: maxDeliveryAttempts=0 is treated as Infinity for back-compat; pass Infinity to disable the cap explicitly.',
      );
      this.#maxDeliveryAttempts = Infinity;
    } else if (cap < 0 || Number.isNaN(cap)) {
      throw new Error(`redis-streams: maxDeliveryAttempts must be >= 1 or Infinity, got ${cap}`);
    } else {
      this.#maxDeliveryAttempts = cap;
    }
  }

  /**
   * Attach the `'error'` listener node-redis requires on every client. Without
   * one, a mid-life socket close makes the client emit an unhandled `'error'`,
   * which (per EventEmitter semantics) throws from inside RedisSocket's error
   * handler BEFORE the built-in reconnect is scheduled — the process gets an
   * uncaughtException and the client is left permanently un-reconnected
   * (isOpen=true, isReady=false), hanging every subsequent command. Merely
   * having a listener lets node-redis's own reconnect run.
   *
   * Logged at warn so operators can see connection churn, throttled to one line
   * per 30s per client: node-redis re-emits `'error'` roughly every 500ms while
   * a server is unreachable, and with one reader client per subscription an
   * outage would otherwise flood the logs with thousands of identical lines.
   */
  #attachErrorLogger(client: RedisClientType, role: 'write' | 'read', extra: Record<string, unknown> = {}): void {
    let lastWarnAt = 0;
    client.on('error', err => {
      const now = Date.now();
      if (now - lastWarnAt < 30_000) return;
      lastWarnAt = now;
      this.#logger?.warn?.(`redis-streams: ${role} client connection error (node-redis will reconnect)`, {
        ...extra,
        err: err instanceof Error ? err.message : err,
      });
    });
  }

  #subKey(topic: string, cb: EventCallback): string {
    let cbId = this.#cbIds.get(cb);
    if (!cbId) {
      cbId = randomUUID();
      this.#cbIds.set(cb, cbId);
    }
    return `${topic}::${cbId}`;
  }

  /** Lazily connect the shared writer client. Idempotent. */
  async #ensureWriterConnected(): Promise<void> {
    if (this.#writeClient.isOpen) return;
    await this.#writeClient.connect();
  }

  #streamKey(topic: string): string {
    return `${this.#keyPrefix}:${topic}`;
  }

  async publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    if (this.#closed) throw new Error('RedisStreamsPubSub: cannot publish on closed client');

    // `localOnly` events stay entirely within the publishing process. They are
    // never serialized through Redis, so live values on the payload (e.g.
    // `MastraModelOutput` returned via `workflows-finish` for an evented
    // agent run) keep their prototype and methods intact.
    if (options?.localOnly) {
      const localEvent: Event = {
        ...event,
        id: randomUUID(),
        createdAt: new Date(),
        deliveryAttempt: event.deliveryAttempt ?? 1,
      };
      this.#deliverLocal(topic, localEvent);
      return;
    }

    await this.#ensureWriterConnected();

    const id = randomUUID();
    const createdAt = new Date();
    const payload: Event = {
      ...event,
      id,
      createdAt,
      deliveryAttempt: event.deliveryAttempt ?? 1,
    };
    const xaddOptions: { TRIM?: { strategy: 'MAXLEN'; strategyModifier: '~'; threshold: number } } = {};
    if (this.#maxStreamLength > 0) {
      xaddOptions.TRIM = {
        strategy: 'MAXLEN',
        strategyModifier: '~',
        threshold: this.#maxStreamLength,
      };
    }
    const streamKey = this.#streamKey(topic);
    // When a TTL is configured the write and its PEXPIRE run in one MULTI
    // transaction. A detached PEXPIRE could fail or be skipped (process exit)
    // after a successful XADD — and on the *last* write before a topic is
    // abandoned there is no "next write" to self-heal, leaving an immortal
    // stream despite the TTL. Atomicity closes that window.
    const promise =
      this.#streamIdleTtlMs > 0
        ? this.#writeClient
            .multi()
            .xAdd(streamKey, '*', { event: JSON.stringify(payload) }, xaddOptions)
            .pExpire(streamKey, this.#streamIdleTtlMs)
            .exec()
            .then(replies => {
              // XADD in the same transaction guarantees the key exists, so
              // PEXPIRE must reply 1; anything else means the TTL backstop is
              // not actually armed for this stream.
              if (Number(replies[1]) !== 1) {
                this.#logger?.warn?.('redis-streams: PEXPIRE inside publish MULTI did not apply', {
                  streamKey,
                  reply: String(replies[1]),
                });
              }
            })
        : this.#writeClient.xAdd(streamKey, '*', { event: JSON.stringify(payload) }, xaddOptions);
    this.#pendingPublishes.add(promise);
    try {
      await promise;
    } finally {
      this.#pendingPublishes.delete(promise);
    }
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (this.#closed) throw new Error('RedisStreamsPubSub: cannot subscribe on closed client');
    const key = this.#subKey(topic, cb);
    if (this.#subscriptions.has(key)) return; // idempotent: same (topic, cb) already subscribed

    // Register for `localOnly` delivery before wiring up the Redis reader so a
    // racing publisher in the same process never misses this subscriber.
    let localBucket = this.#localCallbacks.get(topic);
    if (!localBucket) {
      localBucket = new Set();
      this.#localCallbacks.set(topic, localBucket);
    }
    localBucket.add(cb);

    await this.#ensureWriterConnected();

    const isGrouped = !!options?.group;
    const group = options?.group ?? `__fanout-${randomUUID()}`;
    const consumer = `${group}-${randomUUID()}`;
    const streamKey = this.#streamKey(topic);

    // Create the consumer group if it doesn't exist. MKSTREAM creates the
    // stream if needed. BUSYGROUP means another subscriber raced us — fine.
    //
    // We anchor brand-new groups at '0' (stream start) instead of '$' so that
    // a worker which subscribes after a publish still sees the backlog. This
    // is the "late join" case: a server may publish workflow.start before any
    // orchestrator process exists. Without this, that work is silently lost.
    // Existing groups (BUSYGROUP path) keep their own checkpoint, so this
    // doesn't change semantics for already-running clusters. Stream growth is
    // bounded by the MAXLEN ~ trim applied on every publish.
    try {
      await this.#writeClient.xGroupCreate(streamKey, group, '0', { MKSTREAM: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('BUSYGROUP')) throw err;
      this.#logger?.debug?.('redis-streams: consumer group already exists', { topic, group });
    }

    // Each subscription gets a dedicated reader connection because XREADGROUP
    // with BLOCK > 0 holds the connection until a message arrives.
    const readClient = createClient(this.#connectOptions) as RedisClientType;
    this.#attachErrorLogger(readClient, 'read', { topic });
    await readClient.connect();

    const sub: Subscription = {
      cb,
      topic,
      streamKey,
      group,
      consumer,
      isGrouped,
      readClient,
      stopped: false,
      loop: undefined,
      reclaimTimer: undefined,
    };
    this.#subscriptions.set(key, sub);
    sub.loop = this.#runReadLoop(sub);
    this.#startReclaimLoop(sub);
  }

  /**
   * Periodically run XAUTOCLAIM against this subscription's group so that
   * messages a crashed/stuck consumer read but never acked get redelivered to
   * a live sibling. Runs only for grouped subscriptions — fan-out groups are
   * private to one consumer, so there's no sibling to claim from.
   */
  #startReclaimLoop(sub: Subscription): void {
    if (this.#reclaimIntervalMs <= 0) return;
    if (!sub.isGrouped) return;

    const tick = async () => {
      if (sub.stopped || this.#closed) return;
      try {
        const reply = await this.#writeClient.xAutoClaim(
          sub.streamKey,
          sub.group,
          sub.consumer,
          this.#reclaimIdleMs,
          '0-0',
          { COUNT: 100 },
        );
        const messages = (reply?.messages ?? []) as Array<{ id: string; message: Record<string, string> } | null>;
        for (const entry of messages) {
          if (sub.stopped || this.#closed) return;
          if (!entry) continue;
          await this.#deliverMessage(sub, entry.id, entry.message);
        }
      } catch (err) {
        this.#logger?.debug?.('redis-streams: XAUTOCLAIM failed', {
          topic: sub.topic,
          group: sub.group,
          err: err instanceof Error ? err.message : err,
        });
      }
      if (sub.stopped || this.#closed) return;
      sub.reclaimTimer = setTimeout(tick, this.#reclaimIntervalMs);
    };

    sub.reclaimTimer = setTimeout(tick, this.#reclaimIntervalMs);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const localBucket = this.#localCallbacks.get(topic);
    if (localBucket) {
      localBucket.delete(cb);
      if (localBucket.size === 0) this.#localCallbacks.delete(topic);
    }

    const key = this.#subKey(topic, cb);
    const sub = this.#subscriptions.get(key);
    if (!sub) return;
    this.#subscriptions.delete(key);
    sub.stopped = true;
    if (sub.reclaimTimer) {
      clearTimeout(sub.reclaimTimer);
      sub.reclaimTimer = undefined;
    }

    // Cancel the in-flight blocking XREADGROUP by closing the reader.
    try {
      await sub.readClient.quit();
    } catch (err) {
      this.#logger?.debug?.('redis-streams: reader quit failed', {
        topic: sub.topic,
        err: err instanceof Error ? err.message : err,
      });
    }

    if (sub.loop) {
      try {
        await sub.loop;
      } catch (err) {
        // loop exits naturally when readClient closes; surface only at debug.
        this.#logger?.debug?.('redis-streams: read loop exited with error', {
          topic: sub.topic,
          err: err instanceof Error ? err.message : err,
        });
      }
    }

    // For fan-out, drop the private group entirely so the stream can be reclaimed.
    if (!sub.isGrouped) {
      try {
        await this.#writeClient.xGroupDestroy(sub.streamKey, sub.group);
      } catch (err) {
        this.#logger?.debug?.('redis-streams: xGroupDestroy failed', {
          topic: sub.topic,
          group: sub.group,
          err: err instanceof Error ? err.message : err,
        });
      }
    }
  }

  async flush(): Promise<void> {
    // Wait for any in-flight publishes to settle.
    if (this.#pendingPublishes.size > 0) {
      await Promise.allSettled([...this.#pendingPublishes]);
    }
  }

  /**
   * Delete a topic's stream, and with it every consumer group on that stream.
   * This is the Redis implementation of the optional `clearTopic` hook that
   * consumers (e.g. `DurableAgent`) call to free a topic once its lifecycle is
   * over — without it, a persistent backend accumulates every finished run's
   * stream until Redis exhausts its memory.
   *
   * Because it removes events for ALL consumers and destroys their groups, only
   * call it once nothing will read the topic again. A subscriber still attached
   * when the stream is deleted recovers on its own (the read loop recreates the
   * group on NOGROUP) but will have missed the deleted entries.
   *
   * Best-effort and non-throwing: callers commonly invoke this fire-and-forget
   * (`void clearTopic(...)`), so a rejection would surface as an
   * unhandledRejection. Failures are swallowed and logged; the `streamIdleTtlMs`
   * backstop (when configured) reclaims anything a failed delete leaves behind.
   */
  async clearTopic(topic: string): Promise<void> {
    if (this.#closed) return;
    try {
      await this.#ensureWriterConnected();
      await this.#writeClient.del(this.#streamKey(topic));
    } catch (err) {
      // warn, not debug: a failed delete means the memory leak clearTopic
      // exists to prevent is silently recurring for this topic.
      this.#logger?.warn?.('redis-streams: clearTopic failed', {
        topic,
        err: err instanceof Error ? err.message : err,
      });
    }
  }

  /**
   * Lease key used in Redis. Distinct prefix from streams so leases and
   * streams can't collide on key namespace.
   */
  #leaseKey(key: string): string {
    return `${this.#keyPrefix}:lease:${key}`;
  }

  /**
   * Atomic claim via SET NX PX. Idempotent for the same owner: if the
   * current value is already this owner, we refresh the TTL instead of
   * failing. Cross-process callers race here; Redis serializes them.
   */
  async acquireLease(key: string, owner: string, ttlMs: number): Promise<{ acquired: boolean; owner?: string }> {
    if (this.#closed) return { acquired: false };
    await this.#ensureWriterConnected();
    const redisKey = this.#leaseKey(key);
    const result = await this.#writeClient.set(redisKey, owner, { NX: true, PX: ttlMs });
    if (result === 'OK') return { acquired: true, owner };
    // Someone holds the key. Re-claim only if we still own it, refreshing the
    // TTL atomically: a bare GET+PEXPIRE would let us extend a *new* owner's
    // lease if the key expired and was re-acquired between the two calls.
    const script = `
      local current = redis.call("GET", KEYS[1])
      if current == ARGV[1] then
        redis.call("PEXPIRE", KEYS[1], ARGV[2])
        return 1
      end
      return 0
    `;
    const refreshed = await this.#writeClient.eval(script, {
      keys: [redisKey],
      arguments: [owner, String(ttlMs)],
    });
    if (refreshed === 1) return { acquired: true, owner };
    return { acquired: false, owner: (await this.#writeClient.get(redisKey)) ?? undefined };
  }

  async getLeaseOwner(key: string): Promise<string | undefined> {
    if (this.#closed) return undefined;
    await this.#ensureWriterConnected();
    const current = await this.#writeClient.get(this.#leaseKey(key));
    return current ?? undefined;
  }

  /**
   * Release only if we still own it. Implemented as GET+DEL with a Lua
   * script so the check-and-delete is atomic against concurrent renewals
   * from other processes.
   */
  async releaseLease(key: string, owner: string): Promise<void> {
    if (this.#closed) return;
    await this.#ensureWriterConnected();
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    await this.#writeClient.eval(script, {
      keys: [this.#leaseKey(key)],
      arguments: [owner],
    });
  }

  /**
   * Extend the TTL only if we still own the lease. Returns false if the
   * lease was lost (expired or another owner took it).
   */
  async renewLease(key: string, owner: string, ttlMs: number): Promise<boolean> {
    if (this.#closed) return false;
    await this.#ensureWriterConnected();
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await this.#writeClient.eval(script, {
      keys: [this.#leaseKey(key)],
      arguments: [owner, String(ttlMs)],
    });
    return result === 1;
  }

  /**
   * Atomically hand the lease from `fromOwner` to `toOwner`, refreshing the
   * TTL to the full `ttlMs`, without the key ever going empty.
   *
   * Implemented as a single Lua script (GET == fromOwner -> SET toOwner PX)
   * so a racing process cannot win the key between a release and a re-acquire.
   * Returns false if `fromOwner` no longer holds the lease (expired or taken),
   * in which case the caller should fall back to a fresh `acquireLease`.
   */
  async transferLease(key: string, fromOwner: string, toOwner: string, ttlMs: number): Promise<boolean> {
    if (this.#closed) return false;
    await this.#ensureWriterConnected();
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        redis.call("SET", KEYS[1], ARGV[2], "PX", ARGV[3])
        return 1
      else
        return 0
      end
    `;
    const result = await this.#writeClient.eval(script, {
      keys: [this.#leaseKey(key)],
      arguments: [fromOwner, toOwner, String(ttlMs)],
    });
    return result === 1;
  }

  /**
   * Disconnect all clients and stop all subscription loops.
   */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;

    // Walk the actual subscriptions and pass the original topic through so
    // unsubscribe's key lookup works.
    const subs = [...this.#subscriptions.values()];
    await Promise.all(subs.map(sub => this.unsubscribe(sub.topic, sub.cb)));
    this.#localCallbacks.clear();

    if (this.#writeClient.isOpen) {
      try {
        await this.#writeClient.quit();
      } catch (err) {
        this.#logger?.debug?.('redis-streams: writer quit failed', {
          err: err instanceof Error ? err.message : err,
        });
      }
    }
  }

  async #runReadLoop(sub: Subscription): Promise<void> {
    while (!sub.stopped) {
      let result;
      try {
        result = await sub.readClient.xReadGroup(sub.group, sub.consumer, [{ key: sub.streamKey, id: '>' }], {
          COUNT: 10,
          BLOCK: this.#blockMs,
        });
      } catch (err) {
        if (sub.stopped) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('NOGROUP')) {
          // The stream or its consumer group was deleted out from under us
          // (clearTopic, a streamIdleTtlMs expiry, or an external FLUSH). XREADGROUP
          // returns NOGROUP immediately, ignoring BLOCK, so without recovery
          // this loop busy-retries forever and the subscriber goes permanently
          // deaf — a later publish recreates the stream but not the group.
          // Recreate the group (anchored at '0', matching subscribe()) so
          // delivery resumes.
          try {
            if (this.#streamIdleTtlMs > 0) {
              // MKSTREAM recreates an (empty) stream key, so the TTL must be
              // stamped in the same MULTI — a detached PEXPIRE that fails or is
              // skipped would leave an abandoned-but-recreated topic lingering
              // forever with no further write to self-heal it. Note that when
              // the group already exists (a sibling won the race), exec()
              // throws a MultiErrorReply whose message does NOT contain
              // "BUSYGROUP" — it lives in err.replies — while the PEXPIRE in
              // the same transaction still applies, so the TTL is refreshed
              // even on that path.
              await this.#writeClient
                .multi()
                .xGroupCreate(sub.streamKey, sub.group, '0', { MKSTREAM: true })
                .pExpire(sub.streamKey, this.#streamIdleTtlMs)
                .exec();
            } else {
              await this.#writeClient.xGroupCreate(sub.streamKey, sub.group, '0', { MKSTREAM: true });
            }
            this.#logger?.debug?.('redis-streams: recreated consumer group after NOGROUP', {
              topic: sub.topic,
              group: sub.group,
            });
          } catch (recreateErr) {
            const rmsg = errorText(recreateErr);
            if (!rmsg.includes('BUSYGROUP')) {
              this.#logger?.debug?.('redis-streams: consumer group re-create failed', { topic: sub.topic, err: rmsg });
            }
          }
        } else {
          this.#logger?.debug?.('redis-streams: xReadGroup failed', {
            topic: sub.topic,
            group: sub.group,
            err: msg,
          });
        }
        // Pause briefly then retry (with the group recreated, if it was NOGROUP).
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      if (!result || result.length === 0) continue;

      for (const stream of result) {
        for (const entry of stream.messages) {
          if (sub.stopped) return;
          await this.#deliverMessage(sub, entry.id, entry.message);
        }
      }
    }
  }

  async #deliverMessage(sub: Subscription, streamId: string, fields: Record<string, string>): Promise<void> {
    let event: Event;
    try {
      event = JSON.parse(fields.event ?? '{}') as Event;
      // createdAt is serialized as a string; rehydrate.
      if (typeof event.createdAt === 'string') {
        event.createdAt = new Date(event.createdAt);
      }
    } catch (err) {
      this.#logger?.debug?.('redis-streams: malformed payload, dropping', {
        topic: sub.topic,
        streamId,
        err: err instanceof Error ? err.message : err,
      });
      try {
        await this.#writeClient.xAck(sub.streamKey, sub.group, streamId);
      } catch (ackErr) {
        this.#logger?.debug?.('redis-streams: xAck after malformed payload failed', {
          topic: sub.topic,
          err: ackErr instanceof Error ? ackErr.message : ackErr,
        });
      }
      return;
    }

    let settled = false;
    const ack = async () => {
      if (settled) return;
      settled = true;
      try {
        // Only ack against this consumer group. Do NOT xDel: the stream may
        // be consumed by other groups, and xDel removes the entry for all of
        // them. Stream growth is bounded elsewhere via MAXLEN-style trimming.
        await this.#writeClient.xAck(sub.streamKey, sub.group, streamId);
      } catch (err) {
        this.#logger?.debug?.('redis-streams: ack cleanup failed', {
          topic: sub.topic,
          err: err instanceof Error ? err.message : err,
        });
      }
    };
    const nack = async () => {
      if (settled) return;
      settled = true;
      const attempt = event.deliveryAttempt ?? 1;
      // Cap redelivery to avoid an infinite poison-pill loop. When the cap
      // is hit we drop the event (xAck without republish) and warn so an
      // operator can find it in logs.
      if (attempt >= this.#maxDeliveryAttempts) {
        this.#logger?.warn?.('redis-streams: dropping event after max delivery attempts', {
          topic: sub.topic,
          eventType: event.type,
          eventId: event.id,
          attempt,
          max: this.#maxDeliveryAttempts,
        });
        try {
          // Group-scoped ack only — see ack() above for why we never xDel.
          await this.#writeClient.xAck(sub.streamKey, sub.group, streamId);
        } catch (err) {
          this.#logger?.debug?.('redis-streams: ack on dropped poison message failed', {
            topic: sub.topic,
            err: err instanceof Error ? err.message : err,
          });
        }
        return;
      }
      // Republish with incremented deliveryAttempt FIRST, then ack the
      // original entry. If the republish fails we deliberately leave the
      // original message pending so XAUTOCLAIM (or another consumer) can
      // pick it up on a future tick — acking first would silently drop it.
      const next: Event = {
        ...event,
        deliveryAttempt: attempt + 1,
      };
      try {
        if (this.#streamIdleTtlMs > 0) {
          // A nack republish is a write that keeps this stream in use, so it
          // must refresh the TTL too — otherwise a retry near the end of the
          // original window inherits the old expiry and the stream can be
          // deleted while the retry is still being processed. Same MULTI as
          // the write for the same reason as publish(): the republish may be
          // the stream's final write.
          await this.#writeClient
            .multi()
            .xAdd(sub.streamKey, '*', { event: JSON.stringify(next) })
            .pExpire(sub.streamKey, this.#streamIdleTtlMs)
            .exec();
        } else {
          await this.#writeClient.xAdd(sub.streamKey, '*', { event: JSON.stringify(next) });
        }
      } catch (err) {
        this.#logger?.warn?.('redis-streams: nack republish failed; leaving original pending for reclaim', {
          topic: sub.topic,
          eventId: event.id,
          err: err instanceof Error ? err.message : err,
        });
        // Allow this entry to be redelivered: reset settled so the next
        // delivery attempt (via XAUTOCLAIM) can ack/nack it again.
        settled = false;
        return;
      }
      try {
        await this.#writeClient.xAck(sub.streamKey, sub.group, streamId);
      } catch (err) {
        this.#logger?.debug?.('redis-streams: xAck after nack failed', {
          topic: sub.topic,
          err: err instanceof Error ? err.message : err,
        });
      }
    };

    try {
      // EventCallback is typed `=> void` but handlers commonly return a
      // promise (TS allows Promise<void> to satisfy void). If we get one
      // back, attach a catch handler so async rejections route to nack
      // instead of silently dropping the message. We do NOT await here —
      // serializing messages on a subscription would deadlock orchestration
      // callbacks that await their own future events.
      const result: unknown = sub.cb(event, ack, nack);
      if (result && typeof (result as { then?: unknown; catch?: unknown }).catch === 'function') {
        (result as Promise<unknown>).catch(async () => {
          await nack();
        });
      }
    } catch {
      // Caller threw synchronously — treat as nack.
      await nack();
    }
  }

  #deliverLocal(topic: string, event: Event): void {
    const callbacks = this.#localCallbacks.get(topic);
    if (!callbacks || callbacks.size === 0) return;
    for (const cb of callbacks) {
      this.#invokeLocalCallback(topic, event, cb);
    }
  }

  #invokeLocalCallback(topic: string, event: Event, cb: EventCallback): void {
    // `localOnly` deliveries don't have an external broker to redeliver from,
    // so ack/nack are no-ops here. The caller still gets a real Event object
    // and can branch on `deliveryAttempt` if it cares.
    const ack = async () => {};
    const nack = async () => {};
    try {
      const result: unknown = (cb as (event: Event, ack: () => Promise<void>, nack: () => Promise<void>) => unknown)(
        event,
        ack,
        nack,
      );
      if (result && typeof (result as { then?: unknown; catch?: unknown }).catch === 'function') {
        (result as Promise<unknown>).catch(err => {
          this.#logger?.debug?.('redis-streams: local subscriber rejected', {
            topic,
            err: err instanceof Error ? err.message : err,
          });
        });
      }
    } catch (err) {
      this.#logger?.debug?.('redis-streams: local subscriber threw', {
        topic,
        err: err instanceof Error ? err.message : err,
      });
    }
  }
}

interface Subscription {
  cb: EventCallback;
  topic: string;
  streamKey: string;
  group: string;
  consumer: string;
  isGrouped: boolean;
  readClient: RedisClientType;
  stopped: boolean;
  loop: Promise<void> | undefined;
  reclaimTimer: ReturnType<typeof setTimeout> | undefined;
}
