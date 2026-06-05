import EventEmitter from 'node:events';
import type { IMastraLogger } from '../../logger';
import { PubSub } from '../pubsub';
import type { PubSubDeliveryMode } from '../pubsub';
import type { Event, EventCallback, SubscribeOptions } from '../types';
import { AckHandleBuffer } from './ack-handle-buffer';

export interface EventEmitterPubSubOptions {
  /**
   * Optional logger for surfacing batched-delivery errors. Falls back to
   * `console.error` when not provided.
   */
  logger?: IMastraLogger;
}

// Reused for the fan-out delivery path where ack/nack are no-ops: the process
// is the broker, there is no transport-level redelivery to negotiate. Hoisted
// to module scope so we don't allocate two new closures per emitted event.
const NOOP_ACK = async (): Promise<void> => {};

export class EventEmitterPubSub extends PubSub {
  // EventEmitter dispatches synchronously to listeners, so it can serve both
  // a push consumer (no worker) and a pull-style worker that simply calls
  // `subscribe()` to register a listener. Both modes are advertised so the
  // default in-process setup keeps using OrchestrationWorker, while
  // genuinely push-only transports (GCP Pub/Sub push, SNS, EventBridge)
  // declare `['push']` only and skip the worker.
  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['pull', 'push'];
  }

  /**
   * `EventEmitterPubSub` is strictly in-process, so the `AckHandleBuffer`
   * queue it uses for batching shares the same lifetime as everything
   * else here. Nothing more durable is promised, and nothing less is
   * needed.
   */
  override get supportsNativeBatching(): boolean {
    return true;
  }

  private emitter: EventEmitter;

  // group → topic → callbacks[]
  private groups: Map<string, Map<string, EventCallback[]>> = new Map();
  // "topic:group" → round-robin counter
  private groupCounters: Map<string, number> = new Map();
  // "topic:group" → the single listener registered on the emitter for this group
  private groupListeners: Map<string, (event: Event) => void> = new Map();

  // Track pending nack redeliveries so flush() can wait and close() can cancel them
  private pendingNacks: Set<ReturnType<typeof setTimeout>> = new Set();

  // Track delivery attempts per message id
  private deliveryAttempts: Map<string, number> = new Map();

  // topic → (original callback → wrapped listener) for fan-out (non-group) subscribers.
  // Nested keying so the same callback registered on multiple topics keeps
  // a distinct wrapper per topic.
  private fanoutWrappers: Map<string, Map<EventCallback, (event: Event) => void>> = new Map();

  // topic → (original callback → buffer). Present only for subscribers that
  // opt into batching via `options.batch`. The buffer is the destination of
  // the emitter listener; it invokes the user cb according to its policy.
  private batchBuffers: Map<string, Map<EventCallback, AckHandleBuffer>> = new Map();

  private readonly logger?: IMastraLogger;

  constructor(existingEmitter?: EventEmitter, options: EventEmitterPubSubOptions = {}) {
    super();
    this.emitter = existingEmitter ?? new EventEmitter();
    this.logger = options.logger;
  }

  /**
   * Debug-hostile silent failures are the default for emitter listeners.
   * Surface buffer-side errors on a single channel so they're at least visible.
   */
  private logBufferError(topic: string, err: unknown, ctx: { phase: 'cb' | 'ack-dropped' }): void {
    const message = `[EventEmitterPubSub] batched ${ctx.phase} failed for ${topic}`;
    if (this.logger) {
      this.logger.error(message, err);
    } else {
      console.error(message, err);
    }
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    this.emitter.emit(topic, {
      ...event,
      id,
      createdAt,
      deliveryAttempt: 1,
    });
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (options?.batch) {
      // Batched path: insert an AckHandleBuffer between the emitter and cb.
      // ack/nack are no-ops at this layer — the process is the broker.
      const buffer = new AckHandleBuffer(cb, options.batch, undefined, (err, ctx) => {
        this.logBufferError(topic, err, ctx);
      });
      let byCb = this.batchBuffers.get(topic);
      if (!byCb) {
        byCb = new Map();
        this.batchBuffers.set(topic, byCb);
      }
      byCb.set(cb, buffer);

      if (options.group) {
        // Group path: the group's member list keeps the original `cb` so
        // `unsubscribe(topic, cb)` and round-robin tracking work unchanged.
        // `deliverToGroup` checks `batchBuffers` and routes through the
        // buffer when present.
        this.subscribeWithGroup(topic, cb, options.group);
      } else {
        const wrapper = (event: Event) => {
          // Fire-and-forget — buffer.push can reject if the user-supplied
          // `coalesce` throws or any other policy step fails during an
          // inline flush-now. Surface those through the logger rather
          // than letting them become unhandled rejections.
          void buffer.push(event, NOOP_ACK, NOOP_ACK).catch(err => {
            this.logBufferError(topic, err, { phase: 'cb' });
          });
        };
        let byCbFanout = this.fanoutWrappers.get(topic);
        if (!byCbFanout) {
          byCbFanout = new Map();
          this.fanoutWrappers.set(topic, byCbFanout);
        }
        byCbFanout.set(cb, wrapper);
        this.emitter.on(topic, wrapper);
      }
      return;
    }

    if (options?.group) {
      this.subscribeWithGroup(topic, cb, options.group);
    } else {
      const wrapper = (event: Event) => {
        cb(event, NOOP_ACK, NOOP_ACK);
      };
      let byCb = this.fanoutWrappers.get(topic);
      if (!byCb) {
        byCb = new Map();
        this.fanoutWrappers.set(topic, byCb);
      }
      byCb.set(cb, wrapper);
      this.emitter.on(topic, wrapper);
    }
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    // Tear down a batching buffer for this (topic, cb) pair, if one was set
    // up by `subscribe`. Done first so any in-flight emitter dispatches
    // ignore further events into a disposed buffer.
    const byCbBuffers = this.batchBuffers.get(topic);
    const buffer = byCbBuffers?.get(cb);
    if (buffer && byCbBuffers) {
      buffer.dispose();
      byCbBuffers.delete(cb);
      if (byCbBuffers.size === 0) this.batchBuffers.delete(topic);
    }

    // Check if this callback is in any group for this topic
    for (const [group, topicMap] of this.groups) {
      const members = topicMap.get(topic);
      if (members) {
        const idx = members.indexOf(cb);
        if (idx !== -1) {
          members.splice(idx, 1);
          // If group is now empty for this topic, remove the emitter listener
          if (members.length === 0) {
            topicMap.delete(topic);
            const listenerKey = `${topic}:${group}`;
            const listener = this.groupListeners.get(listenerKey);
            if (listener) {
              this.emitter.off(topic, listener);
              this.groupListeners.delete(listenerKey);
              this.groupCounters.delete(listenerKey);
            }
          }
          if (topicMap.size === 0) {
            this.groups.delete(group);
          }
          return;
        }
      }
    }

    // Not in a group — remove as fan-out listener
    const byCb = this.fanoutWrappers.get(topic);
    const wrapper = byCb?.get(cb);
    if (wrapper && byCb) {
      this.emitter.off(topic, wrapper);
      byCb.delete(cb);
      if (byCb.size === 0) this.fanoutWrappers.delete(topic);
    } else {
      this.emitter.off(topic, cb);
    }
  }

  async flush(): Promise<void> {
    // A batched cb can nack mid-delivery, which schedules a redelivery via
    // setTimeout(0). The redelivered event lands back in `batchBuffers`
    // (the buffer is the group member's destination) and may sit there
    // below maxSize/maxWaitMs thresholds. So we loop: drain buffers, wait
    // for pending nacks to fire, then check whether either side produced
    // more work. Stable-state termination requires both to be empty at the
    // top of a single iteration.
    while (true) {
      const drains: { topic: string; promise: Promise<void> }[] = [];
      for (const [topic, byCb] of this.batchBuffers.entries()) {
        for (const buffer of byCb.values()) {
          drains.push({ topic, promise: buffer.flush() });
        }
      }
      if (drains.length > 0) {
        // allSettled — a single throwing buffer should not block the rest from
        // flushing during shutdown. Rejections that propagate this far skipped
        // the per-event try/catch in AckHandleBuffer (e.g. a throwing coalesce)
        // and must be surfaced or they vanish at shutdown.
        const results = await Promise.allSettled(drains.map(d => d.promise));
        for (let i = 0; i < results.length; i++) {
          const result = results[i]!;
          if (result.status === 'rejected') {
            this.logBufferError(drains[i]!.topic, result.reason, { phase: 'cb' });
          }
        }
      }

      if (this.pendingNacks.size === 0) {
        // Nothing scheduled — and the drain above either did nothing or
        // produced no new pending nacks, so we're stable.
        return;
      }

      // Wait for the currently-scheduled nacks to fire. Each redelivery
      // may land in a buffer; loop and re-drain.
      await new Promise<void>(resolve => {
        const check = () => {
          if (this.pendingNacks.size === 0) {
            resolve();
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }
  }

  /**
   * Clean up all listeners during graceful shutdown.
   */
  async close(): Promise<void> {
    // Cancel pending nack redeliveries
    for (const handle of this.pendingNacks) {
      clearTimeout(handle);
    }
    this.pendingNacks.clear();
    this.deliveryAttempts.clear();

    // Dispose every batching buffer so timers are cleared.
    for (const byCb of this.batchBuffers.values()) {
      for (const buffer of byCb.values()) {
        buffer.dispose();
      }
    }
    this.batchBuffers.clear();

    this.emitter.removeAllListeners();
    this.groups.clear();
    this.groupCounters.clear();
    this.groupListeners.clear();
    this.fanoutWrappers.clear();
  }

  private subscribeWithGroup(topic: string, cb: EventCallback, group: string): void {
    let topicMap = this.groups.get(group);
    if (!topicMap) {
      topicMap = new Map();
      this.groups.set(group, topicMap);
    }

    let members = topicMap.get(topic);
    if (!members) {
      members = [];
      topicMap.set(topic, members);
    }

    members.push(cb);

    // Register a single emitter listener per topic:group pair
    const listenerKey = `${topic}:${group}`;
    if (!this.groupListeners.has(listenerKey)) {
      const listener = (event: Event) => {
        this.deliverToGroup(topic, group, listenerKey, event);
      };

      this.groupListeners.set(listenerKey, listener);
      this.emitter.on(topic, listener);
    }
  }

  private deliverToGroup(topic: string, group: string, listenerKey: string, event: Event): void {
    const currentMembers = this.groups.get(group)?.get(topic);
    if (!currentMembers || currentMembers.length === 0) return;

    const counter = this.groupCounters.get(listenerKey) ?? 0;
    const idx = counter % currentMembers.length;
    this.groupCounters.set(listenerKey, counter + 1);

    // Track delivery attempts scoped per group listener, so ack/nack in one
    // group doesn't disturb another group's attempt counter for the same event.
    const attemptKey = `${listenerKey}:${event.id}`;
    const attempt = this.deliveryAttempts.get(attemptKey) ?? 1;
    const eventWithAttempt = { ...event, deliveryAttempt: attempt };

    const ack = async () => {
      // Message successfully processed — clean up attempt tracking
      this.deliveryAttempts.delete(attemptKey);
    };

    const nack = async () => {
      // Message processing failed — redeliver to the group after a short delay
      // Increment delivery attempt counter
      this.deliveryAttempts.set(attemptKey, attempt + 1);

      const handle = setTimeout(() => {
        this.pendingNacks.delete(handle);
        this.deliverToGroup(topic, group, listenerKey, event);
      }, 0);
      this.pendingNacks.add(handle);
    };

    const member = currentMembers[idx]!;
    // If this member opted into batching, route through its buffer.
    const buffer = this.batchBuffers.get(topic)?.get(member);
    if (buffer) {
      // Same rationale as the fan-out push above: surface rejections
      // through the logger so they don't escape as unhandled.
      void buffer.push(eventWithAttempt, ack, nack).catch(err => {
        this.logBufferError(topic, err, { phase: 'cb' });
      });
    } else {
      member(eventWithAttempt, ack, nack);
    }
  }

  // key → { owner, expiresAt }. In-process so a single Map is enough;
  // there is no other process to race against. The same owner can renew
  // their own reservation; expired entries are reclaimed lazily on the
  // next tryReserve call.
  private reservations: Map<string, { owner: string; expiresAt: number }> = new Map();

  override tryReserve(key: string, owner: string, ttlMs: number): Promise<{ acquired: boolean; owner?: string }> {
    const now = Date.now();
    const existing = this.reservations.get(key);
    if (existing && existing.expiresAt > now && existing.owner !== owner) {
      return Promise.resolve({ acquired: false, owner: existing.owner });
    }
    this.reservations.set(key, { owner, expiresAt: now + ttlMs });
    return Promise.resolve({ acquired: true, owner });
  }

  override getReservation(key: string): Promise<string | undefined> {
    const existing = this.reservations.get(key);
    if (!existing) return Promise.resolve(undefined);
    if (existing.expiresAt <= Date.now()) {
      this.reservations.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(existing.owner);
  }

  override releaseReservation(key: string, owner: string): Promise<void> {
    const existing = this.reservations.get(key);
    if (existing && existing.owner === owner) {
      this.reservations.delete(key);
    }
    return Promise.resolve();
  }

  override renewReservation(key: string, owner: string, ttlMs: number): Promise<boolean> {
    const existing = this.reservations.get(key);
    if (!existing || existing.owner !== owner || existing.expiresAt <= Date.now()) {
      return Promise.resolve(false);
    }
    existing.expiresAt = Date.now() + ttlMs;
    return Promise.resolve(true);
  }
}
