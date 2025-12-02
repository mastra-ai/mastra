import { BaseSubject } from "./BaseSubject";
import { SubscribableWithState } from "./Subscribable";
import { SKIP_UPDATE } from "./SKIP_UPDATE";
export declare class ShallowMemoizeSubject<TState extends object, TPath> extends BaseSubject implements SubscribableWithState<TState, TPath> {
    private binding;
    get path(): TPath;
    constructor(binding: SubscribableWithState<TState | SKIP_UPDATE, TPath>);
    private _previousState;
    getState: () => TState;
    private _syncState;
    protected _connect(): import("../..").Unsubscribe;
}
//# sourceMappingURL=ShallowMemoizeSubject.d.ts.map