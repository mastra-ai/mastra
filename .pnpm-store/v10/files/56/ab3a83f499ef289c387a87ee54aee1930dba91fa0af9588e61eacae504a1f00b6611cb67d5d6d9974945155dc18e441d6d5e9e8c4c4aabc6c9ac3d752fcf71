type Listener<T> = (e: MessageEvent<T>) => void;
/**
 * @deprecated This class will be completely removed in the next major version.
 * Use the native BroadcastChannel API directly instead.
 */
declare class LocalStorageBroadcastChannel<E> {
    private readonly eventTarget;
    private readonly channelKey;
    constructor(name: string);
    postMessage: (data: E) => void;
    addEventListener: (eventName: "message", listener: Listener<E>) => void;
    private setupLocalStorageListener;
    private prefixEventName;
}

export { LocalStorageBroadcastChannel };
