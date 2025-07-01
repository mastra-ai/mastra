import EventEmitter from 'events';
import { PubSub } from './pubsub';

export class EventEmitterPubSub extends PubSub {
  private emitter: EventEmitter;

  constructor() {
    super();
    this.emitter = new EventEmitter();
  }

  async publish(topic: string, event: Event): Promise<void> {
    this.emitter.emit(topic, event);
  }

  async subscribe(topic: string, cb: (event: Event) => void): Promise<void> {
    this.emitter.on(topic, cb);
  }

  async unsubscribe(topic: string, cb: (event: Event) => void): Promise<void> {
    this.emitter.off(topic, cb);
  }
}
