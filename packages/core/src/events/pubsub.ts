import type { Event, SubscribeOptions } from './types';

export abstract class PubSub {
  abstract publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void>;
  abstract subscribe(
    topic: string,
    cb: (event: Event, ack?: () => Promise<void>) => void,
    options?: SubscribeOptions,
  ): Promise<void>;
  abstract unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void>;
  abstract flush(): Promise<void>;
}
