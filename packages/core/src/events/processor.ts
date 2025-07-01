import type { PubSub } from './pubsub';

export abstract class EventProcessor {
  protected pubsub: PubSub;

  constructor(pubsub: PubSub) {
    this.pubsub = pubsub;
  }

  protected abstract process(event: Event): Promise<void>;
}
