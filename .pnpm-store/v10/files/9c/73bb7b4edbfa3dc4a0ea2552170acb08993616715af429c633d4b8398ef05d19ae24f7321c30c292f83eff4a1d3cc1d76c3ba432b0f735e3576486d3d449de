import { PubSub } from './pubsub.js';
import type { Event } from './types.js';
export declare class EventEmitterPubSub extends PubSub {
    private emitter;
    constructor();
    publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void>;
    subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void>;
    unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void>;
    flush(): Promise<void>;
}
//# sourceMappingURL=event-emitter.d.ts.map