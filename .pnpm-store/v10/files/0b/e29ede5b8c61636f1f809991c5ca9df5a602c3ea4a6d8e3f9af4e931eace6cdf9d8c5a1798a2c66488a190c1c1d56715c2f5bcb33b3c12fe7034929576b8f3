import type { Unsubscribe } from "../../types";
import { ExternalStoreThreadRuntimeCore } from "./ExternalStoreThreadRuntimeCore";
import { ThreadListRuntimeCore } from "../core/ThreadListRuntimeCore";
import { ExternalStoreThreadData, ExternalStoreThreadListAdapter } from "./ExternalStoreAdapter";
export type ExternalStoreThreadFactory = () => ExternalStoreThreadRuntimeCore;
export declare class ExternalStoreThreadListRuntimeCore implements ThreadListRuntimeCore {
    private adapter;
    private threadFactory;
    private _mainThreadId;
    private _threads;
    private _archivedThreads;
    get isLoading(): boolean;
    get newThreadId(): undefined;
    get threadIds(): readonly string[];
    get archivedThreadIds(): readonly string[];
    getLoadThreadsPromise(): Promise<void>;
    private _mainThread;
    get mainThreadId(): string;
    constructor(adapter: ExternalStoreThreadListAdapter | undefined, threadFactory: ExternalStoreThreadFactory);
    getMainThreadRuntimeCore(): ExternalStoreThreadRuntimeCore;
    getThreadRuntimeCore(): never;
    getItemById(threadId: string): ExternalStoreThreadData<"regular"> | ExternalStoreThreadData<"archived"> | undefined;
    __internal_setAdapter(adapter: ExternalStoreThreadListAdapter): void;
    switchToThread(threadId: string): Promise<void>;
    switchToNewThread(): Promise<void>;
    rename(threadId: string, newTitle: string): Promise<void>;
    detach(): Promise<void>;
    archive(threadId: string): Promise<void>;
    unarchive(threadId: string): Promise<void>;
    delete(threadId: string): Promise<void>;
    initialize(): never;
    generateTitle(): never;
    private _subscriptions;
    subscribe(callback: () => void): Unsubscribe;
    private _notifySubscribers;
}
//# sourceMappingURL=ExternalStoreThreadListRuntimeCore.d.ts.map