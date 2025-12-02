import { Unsubscribe } from "../../types";
import { BaseSubject } from "./BaseSubject";
import { NestedSubscribable, Subscribable, SubscribableWithState } from "./Subscribable";
export declare class NestedSubscriptionSubject<TState extends Subscribable | undefined, TPath> extends BaseSubject implements SubscribableWithState<TState, TPath>, NestedSubscribable<TState, TPath> {
    private binding;
    get path(): TPath;
    constructor(binding: NestedSubscribable<TState, TPath>);
    getState(): TState;
    outerSubscribe(callback: () => void): Unsubscribe;
    protected _connect(): Unsubscribe;
}
//# sourceMappingURL=NestedSubscriptionSubject.d.ts.map