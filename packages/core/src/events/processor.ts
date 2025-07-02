import type { PubSub } from './pubsub';
import type { Event } from './types';

export abstract class EventProcessor {
  protected pubsub: PubSub;

  constructor({ pubsub }: { pubsub: PubSub }) {
    this.pubsub = pubsub;
  }

  protected abstract process(event: Event): Promise<void>;
}
