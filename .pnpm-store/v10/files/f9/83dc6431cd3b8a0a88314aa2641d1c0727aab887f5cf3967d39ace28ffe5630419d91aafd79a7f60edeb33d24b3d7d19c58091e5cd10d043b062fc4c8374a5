import { Unsubscribe } from "../../types";
import { BaseSubject } from "./BaseSubject";
import { EventSubscribable } from "./Subscribable";
export declare class EventSubscriptionSubject<TEvent extends string> extends BaseSubject {
    private config;
    constructor(config: EventSubscribable<TEvent>);
    getState(): {
        unstable_on: (event: TEvent, callback: () => void) => Unsubscribe;
    } | undefined;
    outerSubscribe(callback: () => void): Unsubscribe;
    protected _connect(): Unsubscribe;
}
//# sourceMappingURL=EventSubscriptionSubject.d.ts.map