import type { Event } from './types.js';
export declare abstract class PubSub {
    abstract publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void>;
    abstract subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void>;
    abstract unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void>;
    abstract flush(): Promise<void>;
}
//# sourceMappingURL=pubsub.d.ts.map