import { randomUUID } from 'node:crypto';
import { PubSub } from '@mastra/core/events';
import type { Event, EventCallback, PubSubDeliveryMode, SubscribeOptions } from '@mastra/core/events';
import { createClient } from 'redis';
import type { RedisClientOptions, RedisClientType } from 'redis';

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

export class RedisStreamsPubSub extends PubSub {
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
  #closed = false;

  constructor(options: RedisStreamsPubSubConfig = {}) {
    super();
    const url = options.url ?? options.redisOptions?.url ?? 'redis://localhost:6379';
    this.#connectOptions = { ...options.redisOptions, url };
    this.#writeClient = createClient(this.#connectOptions) as RedisClientType;
    this.#keyPrefix = options.keyPrefix ?? 'mastra:topic';
    this.#blockMs = options.blockMs ?? 1000;
    this.#maxStreamLength = options.maxStreamLength ?? 10_000;
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
    this.#logger = options.logger;
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

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    if (this.#closed) throw new Error('RedisStreamsPubSub: cannot publish on closed client');
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
    const promise = this.#writeClient.xAdd(
      this.#streamKey(topic),
      '*',
      { event: JSON.stringify(payload) },
      xaddOptions,
    );
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
   * Disconnect all clients and stop all subscription loops.
   */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;

    // Walk the actual subscriptions and pass the original topic through so
    // unsubscribe's key lookup works.
    const subs = [...this.#subscriptions.values()];
    await Promise.all(subs.map(sub => this.unsubscribe(sub.topic, sub.cb)));

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
        this.#logger?.debug?.('redis-streams: xReadGroup failed', {
          topic: sub.topic,
          group: sub.group,
          err: err instanceof Error ? err.message : err,
        });
        // Connection error or similar — pause briefly then retry.
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
        await this.#writeClient.xAdd(sub.streamKey, '*', { event: JSON.stringify(next) });
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
