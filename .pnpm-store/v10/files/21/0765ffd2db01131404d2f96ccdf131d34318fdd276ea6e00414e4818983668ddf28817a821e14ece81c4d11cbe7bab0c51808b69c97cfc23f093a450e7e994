import { IDisposable } from "./IDisposable.js";
import { List } from "./List.js";
export interface IQueue<TItem> extends IDisposable {
    enqueue(item: TItem): void;
    enqueueFromPromise(promise: Promise<TItem>): void;
    dequeue(): Promise<TItem>;
    peek(): Promise<TItem>;
    length(): number;
}
export declare class Queue<TItem> implements IQueue<TItem> {
    private privPromiseStore;
    private privList;
    private privDetachables;
    private privSubscribers;
    private privIsDrainInProgress;
    private privIsDisposing;
    private privDisposeReason;
    constructor(list?: List<TItem>);
    enqueue(item: TItem): void;
    enqueueFromPromise(promise: Promise<TItem>): void;
    dequeue(): Promise<TItem>;
    peek(): Promise<TItem>;
    length(): number;
    isDisposed(): boolean;
    drainAndDispose(pendingItemProcessor: (pendingItemInQueue: TItem) => void, reason?: string): Promise<void>;
    dispose(reason?: string): Promise<void>;
    private drain;
    private throwIfDispose;
}
