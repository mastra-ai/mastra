import { ThreadListRuntimeCore } from "../runtimes/core/ThreadListRuntimeCore";
import { Unsubscribe } from "../types";
import { ThreadListItemRuntime, ThreadListItemRuntimeImpl } from "./ThreadListItemRuntime";
import { ThreadListItemRuntimeBinding, ThreadRuntime, ThreadRuntimeCoreBinding } from "./ThreadRuntime";
export type ThreadListState = {
    readonly mainThreadId: string;
    readonly newThread: string | undefined;
    readonly threads: readonly string[];
    readonly archivedThreads: readonly string[];
    readonly isLoading: boolean;
};
export type ThreadListRuntime = {
    getState(): ThreadListState;
    readonly isLoading: boolean;
    subscribe(callback: () => void): Unsubscribe;
    readonly main: ThreadRuntime;
    getById(threadId: string): ThreadRuntime;
    readonly mainItem: ThreadListItemRuntime;
    getItemById(threadId: string): ThreadListItemRuntime;
    getItemByIndex(idx: number): ThreadListItemRuntime;
    getArchivedItemByIndex(idx: number): ThreadListItemRuntime;
    switchToThread(threadId: string): Promise<void>;
    switchToNewThread(): Promise<void>;
};
export type ThreadListRuntimeCoreBinding = ThreadListRuntimeCore;
export declare class ThreadListRuntimeImpl implements ThreadListRuntime {
    private _core;
    private _runtimeFactory;
    private _getState;
    constructor(_core: ThreadListRuntimeCoreBinding, _runtimeFactory?: new (binding: ThreadRuntimeCoreBinding, threadListItemBinding: ThreadListItemRuntimeBinding) => ThreadRuntime);
    protected __internal_bindMethods(): void;
    switchToThread(threadId: string): Promise<void>;
    switchToNewThread(): Promise<void>;
    getState(): ThreadListState;
    get isLoading(): boolean;
    subscribe(callback: () => void): Unsubscribe;
    private _mainThreadListItemRuntime;
    readonly main: ThreadRuntime;
    get mainItem(): ThreadListItemRuntimeImpl;
    getById(threadId: string): ThreadRuntime;
    getItemByIndex(idx: number): ThreadListItemRuntimeImpl;
    getArchivedItemByIndex(idx: number): ThreadListItemRuntimeImpl;
    getItemById(threadId: string): ThreadListItemRuntimeImpl;
}
//# sourceMappingURL=ThreadListRuntime.d.ts.map