import { Unsubscribe } from "../types";
import { ThreadListItemRuntimePath } from "./RuntimePathTypes";
import { SubscribableWithState } from "./subscribable/Subscribable";
import { ThreadListRuntimeCoreBinding } from "./ThreadListRuntime";
export type ThreadListItemEventType = "switched-to" | "switched-away";
import type { ThreadListItemState, ThreadListItemStatus } from "./RuntimeBindings";
export type { ThreadListItemState, ThreadListItemStatus };
export type ThreadListItemRuntime = {
    readonly path: ThreadListItemRuntimePath;
    getState(): ThreadListItemState;
    initialize(): Promise<{
        remoteId: string;
        externalId: string | undefined;
    }>;
    generateTitle(): Promise<void>;
    switchTo(): Promise<void>;
    rename(newTitle: string): Promise<void>;
    archive(): Promise<void>;
    unarchive(): Promise<void>;
    delete(): Promise<void>;
    /**
     * Detaches the ThreadListItem instance, unmounting the ThreadRuntime hook.
     */
    detach(): void;
    subscribe(callback: () => void): Unsubscribe;
    unstable_on(event: ThreadListItemEventType, callback: () => void): Unsubscribe;
};
export type ThreadListItemStateBinding = SubscribableWithState<ThreadListItemState, ThreadListItemRuntimePath>;
export declare class ThreadListItemRuntimeImpl implements ThreadListItemRuntime {
    private _core;
    private _threadListBinding;
    get path(): ThreadListItemRuntimePath;
    constructor(_core: ThreadListItemStateBinding, _threadListBinding: ThreadListRuntimeCoreBinding);
    protected __internal_bindMethods(): void;
    getState(): ThreadListItemState;
    switchTo(): Promise<void>;
    rename(newTitle: string): Promise<void>;
    archive(): Promise<void>;
    unarchive(): Promise<void>;
    delete(): Promise<void>;
    initialize(): Promise<{
        remoteId: string;
        externalId: string | undefined;
    }>;
    generateTitle(): Promise<void>;
    unstable_on(event: ThreadListItemEventType, callback: () => void): Unsubscribe;
    subscribe(callback: () => void): Unsubscribe;
    detach(): void;
}
//# sourceMappingURL=ThreadListItemRuntime.d.ts.map