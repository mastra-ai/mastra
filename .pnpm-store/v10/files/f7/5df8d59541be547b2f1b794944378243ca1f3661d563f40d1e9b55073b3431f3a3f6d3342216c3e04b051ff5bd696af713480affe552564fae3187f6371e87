import { Unsubscribe } from "../../types/Unsubscribe";
export declare abstract class BaseSubject {
    private _subscriptions;
    private _connection;
    protected get isConnected(): boolean;
    protected abstract _connect(): Unsubscribe;
    protected notifySubscribers(): void;
    private _updateConnection;
    subscribe(callback: () => void): () => void;
}
//# sourceMappingURL=BaseSubject.d.ts.map