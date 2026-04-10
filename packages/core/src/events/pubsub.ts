import type { Event, EventCallback, SubscribeOptions } from './types';

export abstract class PubSub {
  abstract publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void>;
  abstract subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void>;
  abstract unsubscribe(topic: string, cb: EventCallback): Promise<void>;
  abstract flush(): Promise<void>;
}
