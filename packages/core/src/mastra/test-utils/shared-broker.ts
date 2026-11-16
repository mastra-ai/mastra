/**
 * An in-memory stand-in for a broker that several Mastra instances connect to,
 * the way pods share one Redis or queue. It fans every event out to every
 * connection at once and never holds or redelivers an event. A connection is
 * not an `EventEmitterPubSub`, so Mastra treats it as a broker.
 *
 * With `redeliversUnacked`, a connection reports that its broker redelivers a
 * dead consumer's messages, so recovery leaves evented runs to it. It still
 * redelivers nothing: tests that use it check what recovery does, not the
 * broker.
 */
import { EventEmitter } from 'node:events';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { PubSub } from '../../events/pubsub';
import type { PubSubDeliveryMode } from '../../events/pubsub';
import type { Event, EventCallback, SubscribeOptions } from '../../events/types';

/** One instance's connection to a {@link sharedBroker}. */
class BrokerConnection extends PubSub {
  readonly #inner: EventEmitterPubSub;
  readonly #redeliversUnacked: boolean;

  constructor(emitter: EventEmitter, redeliversUnacked: boolean) {
    super();
    this.#inner = new EventEmitterPubSub(emitter);
    this.#redeliversUnacked = redeliversUnacked;
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return this.#inner.supportedModes;
  }

  override get redeliversUnacked(): boolean {
    return this.#redeliversUnacked;
  }

  publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }): Promise<void> {
    return this.#inner.publish(topic, event, options);
  }

  subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    return this.#inner.subscribe(topic, cb, options);
  }

  unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    return this.#inner.unsubscribe(topic, cb);
  }

  flush(): Promise<void> {
    return this.#inner.flush();
  }
}

/** A broker; `connect()` opens a pubsub for one Mastra instance. */
export function sharedBroker({ redeliversUnacked = false }: { redeliversUnacked?: boolean } = {}) {
  const emitter = new EventEmitter();
  // Many replicas and per-run waiters subscribe to the same topics.
  emitter.setMaxListeners(0);
  return { connect: (): PubSub => new BrokerConnection(emitter, redeliversUnacked) };
}
