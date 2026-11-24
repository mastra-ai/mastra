/**
 * An in-memory stand-in for a broker that several Mastra instances connect to,
 * the way pods share one Redis or queue. It fans every event out to every
 * connection at once and never holds or redelivers an event. A connection
 * keeps the default `deliversAcrossProcesses`, so Mastra treats it as a broker.
 * A `localOnly` publish reaches only the publishing connection, as on a real
 * broker, so events Mastra keeps in one process don't leak to the others.
 *
 * With `redeliversUnacked`, a connection reports that its broker redelivers a
 * dead consumer's messages, so recovery leaves evented runs to it. It still
 * redelivers nothing: tests that use it check what recovery does, not the
 * broker.
 *
 * With `leases`, every connection is a `LeaseProvider` over one lease table
 * for the whole broker, so a lease taken through one connection is visible
 * through the others. Without it a connection has no leases, and Mastra uses
 * its no-op provider.
 */
import { EventEmitter } from 'node:events';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { PubSub } from '../../events/pubsub';
import type { LeaseProvider, PubSubDeliveryMode } from '../../events/pubsub';
import type { Event, EventCallback, SubscribeOptions } from '../../events/types';

/** One instance's connection to a {@link sharedBroker}. */
export class BrokerConnection extends PubSub {
  readonly #shared: EventEmitterPubSub;
  readonly #local: EventEmitterPubSub;
  readonly #redeliversUnacked: boolean;
  readonly #subscriptions: Array<[string, EventCallback]> = [];

  constructor(emitter: EventEmitter, redeliversUnacked: boolean) {
    super();
    this.#shared = new EventEmitterPubSub(emitter);
    const local = new EventEmitter();
    local.setMaxListeners(0);
    this.#local = new EventEmitterPubSub(local);
    this.#redeliversUnacked = redeliversUnacked;
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return this.#shared.supportedModes;
  }

  override get redeliversUnacked(): boolean {
    return this.#redeliversUnacked;
  }

  publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }): Promise<void> {
    return (options?.localOnly ? this.#local : this.#shared).publish(topic, event, options);
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    this.#subscriptions.push([topic, cb]);
    await Promise.all([this.#shared.subscribe(topic, cb, options), this.#local.subscribe(topic, cb, options)]);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const index = this.#subscriptions.findIndex(([t, c]) => t === topic && c === cb);
    if (index !== -1) this.#subscriptions.splice(index, 1);
    await Promise.all([this.#shared.unsubscribe(topic, cb), this.#local.unsubscribe(topic, cb)]);
  }

  async flush(): Promise<void> {
    await Promise.all([this.#shared.flush(), this.#local.flush()]);
  }

  /** Drops this connection's subscriptions. The shared emitter stays open for the other connections. */
  async close(): Promise<void> {
    for (const [topic, cb] of this.#subscriptions.splice(0)) {
      await this.#shared.unsubscribe(topic, cb);
    }
    await this.#local.close();
  }
}

/** A connection whose leases live in its broker's one lease table. */
export class LeasingBrokerConnection extends BrokerConnection implements LeaseProvider {
  readonly #leases: EventEmitterPubSub;

  constructor(emitter: EventEmitter, redeliversUnacked: boolean, leases: EventEmitterPubSub) {
    super(emitter, redeliversUnacked);
    this.#leases = leases;
  }

  acquireLease(key: string, owner: string, ttlMs: number) {
    return this.#leases.acquireLease(key, owner, ttlMs);
  }

  getLeaseOwner(key: string) {
    return this.#leases.getLeaseOwner(key);
  }

  releaseLease(key: string, owner: string) {
    return this.#leases.releaseLease(key, owner);
  }

  renewLease(key: string, owner: string, ttlMs: number) {
    return this.#leases.renewLease(key, owner, ttlMs);
  }

  transferLease(key: string, fromOwner: string, toOwner: string, ttlMs: number) {
    return this.#leases.transferLease(key, fromOwner, toOwner, ttlMs);
  }
}

type BrokerOptions = { redeliversUnacked?: boolean; leases?: boolean };

/** A broker; `connect()` opens a pubsub for one Mastra instance. */
export function sharedBroker(options: BrokerOptions & { leases: true }): { connect: () => LeasingBrokerConnection };
export function sharedBroker(options?: BrokerOptions): { connect: () => BrokerConnection };
export function sharedBroker({ redeliversUnacked = false, leases = false }: BrokerOptions = {}) {
  const emitter = new EventEmitter();
  // Many replicas and per-run waiters subscribe to the same topics.
  emitter.setMaxListeners(0);
  const leaseTable = leases ? new EventEmitterPubSub() : undefined;
  return {
    connect: (): BrokerConnection =>
      leaseTable
        ? new LeasingBrokerConnection(emitter, redeliversUnacked, leaseTable)
        : new BrokerConnection(emitter, redeliversUnacked),
  };
}
