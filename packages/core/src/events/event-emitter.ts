import EventEmitter from 'events';
import { PubSub } from './pubsub';
import type { Event } from './types';

export class EventEmitterPubSub extends PubSub {
  private emitter: EventEmitter;

  constructor() {
    super();
    this.emitter = new EventEmitter();
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    this.emitter.emit(topic, {
      ...event,
      id,
      createdAt,
    });
  }

  async subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    this.emitter.on(topic, cb);
  }

  async unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    this.emitter.off(topic, cb);
  }

  async flush(): Promise<void> {
    // no-op
  }
}
