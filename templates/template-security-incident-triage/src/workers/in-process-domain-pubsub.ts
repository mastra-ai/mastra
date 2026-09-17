import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { PubSub, type Event, type EventCallback, type SubscribeOptions } from '@mastra/core/events';

type Subscription = Readonly<{
  callback: EventCallback;
  group?: string;
}>;

/**
 * Local domain-event transport with broker-like delivery completion.
 *
 * Mastra's EventEmitter transport intentionally resolves `publish()` as soon
 * as an event is emitted. That behavior is ideal for Mastra's own orchestration
 * traffic, but it lets the transactional-outbox dispatcher and its subscriber
 * write to the same embedded SQLite database concurrently. This transport
 * waits for the selected consumer to ACK or NACK before the publisher resumes,
 * preserving the single-process ordering that a local database requires.
 */
export class InProcessDomainPubSub extends PubSub {
  private readonly subscriptions = new Map<string, Subscription[]>();
  private readonly groupOffsets = new Map<string, number>();
  private readonly inFlight = new Set<Promise<void>>();
  private closed = false;
  private readonly shutdown = new AbortController();
  private readonly maxDeliveryAttempts: number;
  private readonly retryDelayMs: number;

  constructor(
    options: Readonly<{
      maxDeliveryAttempts?: number;
      retryDelayMs?: number;
    }> = {},
  ) {
    super();
    this.maxDeliveryAttempts = options.maxDeliveryAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 10;
    if (
      !Number.isInteger(this.maxDeliveryAttempts) ||
      this.maxDeliveryAttempts < 1 ||
      this.maxDeliveryAttempts > 10 ||
      !Number.isInteger(this.retryDelayMs) ||
      this.retryDelayMs < 1 ||
      this.retryDelayMs > 1_000
    )
      throw new Error('IN_PROCESS_DOMAIN_PUBSUB_OPTIONS_INVALID');
  }

  override get supportedModes(): ReadonlyArray<'push'> {
    return ['push'];
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    if (this.closed) throw new Error('IN_PROCESS_DOMAIN_PUBSUB_CLOSED');

    const delivery = this.deliver(topic, {
      ...event,
      id: randomUUID(),
      createdAt: new Date(),
      deliveryAttempt: 1,
    });
    this.inFlight.add(delivery);
    try {
      await delivery;
    } finally {
      this.inFlight.delete(delivery);
    }
  }

  async subscribe(topic: string, callback: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (this.closed) throw new Error('IN_PROCESS_DOMAIN_PUBSUB_CLOSED');
    const current = this.subscriptions.get(topic) ?? [];
    current.push({
      callback,
      ...(options?.group ? { group: options.group } : {}),
    });
    this.subscriptions.set(topic, current);
  }

  async unsubscribe(topic: string, callback: EventCallback): Promise<void> {
    const current = this.subscriptions.get(topic);
    if (!current) return;
    const remaining = current.filter(subscription => subscription.callback !== callback);
    if (remaining.length > 0) this.subscriptions.set(topic, remaining);
    else this.subscriptions.delete(topic);
  }

  async flush(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight]);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.shutdown.abort();
    await this.flush();
    this.subscriptions.clear();
    this.groupOffsets.clear();
  }

  private async deliver(topic: string, event: Event): Promise<void> {
    const selected = this.selectSubscribers(topic);
    if (topic === 'security.alert.received' && selected.length === 0)
      throw new Error('IN_PROCESS_DOMAIN_PUBSUB_NO_CONSUMER');
    const results = await Promise.allSettled(
      selected.map(subscription => this.deliverUntilSettled(subscription.callback, event)),
    );
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }

  private selectSubscribers(topic: string): readonly Subscription[] {
    const current = this.subscriptions.get(topic) ?? [];
    const fanout = current.filter(subscription => !subscription.group);
    const grouped = new Map<string, Subscription[]>();
    for (const subscription of current) {
      if (!subscription.group) continue;
      const members = grouped.get(subscription.group) ?? [];
      members.push(subscription);
      grouped.set(subscription.group, members);
    }

    const selected = [...fanout];
    for (const [group, members] of grouped) {
      const key = `${topic}:${group}`;
      const offset = this.groupOffsets.get(key) ?? 0;
      selected.push(members[offset % members.length]!);
      this.groupOffsets.set(key, offset + 1);
    }
    return selected;
  }

  private async deliverUntilSettled(callback: EventCallback, original: Event): Promise<void> {
    let attempt = original.deliveryAttempt ?? 1;
    while (!this.closed && attempt <= this.maxDeliveryAttempts) {
      const delivery: { disposition: 'pending' | 'ack' | 'nack' } = {
        disposition: 'pending',
      };
      const settle = (value: 'ack' | 'nack') => async () => {
        if (delivery.disposition === 'pending') delivery.disposition = value;
      };
      await callback({ ...original, deliveryAttempt: attempt }, settle('ack'), settle('nack'));
      if (delivery.disposition === 'ack') return;
      if (this.closed) throw new Error('IN_PROCESS_DOMAIN_PUBSUB_CLOSED');
      if (delivery.disposition === 'pending') throw new Error('IN_PROCESS_DOMAIN_PUBSUB_ACK_REQUIRED');
      if (attempt === this.maxDeliveryAttempts) throw new Error('IN_PROCESS_DOMAIN_PUBSUB_RETRY_EXHAUSTED');
      attempt += 1;
      try {
        await delay(this.retryDelayMs, undefined, {
          signal: this.shutdown.signal,
        });
      } catch {
        throw new Error('IN_PROCESS_DOMAIN_PUBSUB_CLOSED');
      }
    }
    throw new Error('IN_PROCESS_DOMAIN_PUBSUB_CLOSED');
  }
}
