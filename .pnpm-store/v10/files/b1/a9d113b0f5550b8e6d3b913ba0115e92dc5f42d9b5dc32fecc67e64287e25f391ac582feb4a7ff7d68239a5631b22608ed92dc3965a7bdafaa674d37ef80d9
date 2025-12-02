import { AssistantRuntimeCore } from "../runtimes/core/AssistantRuntimeCore";
import { ModelContextProvider } from "../model-context/ModelContextTypes";
import { ThreadRuntime } from "./ThreadRuntime";
import { Unsubscribe } from "../types";
import { ThreadListRuntime, ThreadListRuntimeImpl } from "./ThreadListRuntime";
import { ThreadMessageLike } from "../runtimes";
export type AssistantRuntime = {
    /**
     * The threads in this assistant.
     */
    readonly threads: ThreadListRuntime;
    /**
     * The currently selected main thread. Equivalent to `threads.main`.
     */
    readonly thread: ThreadRuntime;
    /**
     * @deprecated This field was renamed to `threads`.
     */
    readonly threadList: ThreadListRuntime;
    /**
     * Switch to a new thread.
     *
     * @deprecated This method was moved to `threads.switchToNewThread`.
     */
    switchToNewThread(): void;
    /**
     * Switch to a thread.
     *
     * @param threadId The thread ID to switch to.
     * @deprecated This method was moved to `threads.switchToThread`.
     */
    switchToThread(threadId: string): void;
    /**
     * Register a model context provider. Model context providers are configuration such as system message, temperature, etc. that are set in the frontend.
     *
     * @param provider The model context provider to register.
     */
    registerModelContextProvider(provider: ModelContextProvider): Unsubscribe;
    /**
     * @deprecated This method was renamed to `registerModelContextProvider`.
     */
    registerModelConfigProvider(provider: ModelContextProvider): Unsubscribe;
    /**
     * @deprecated Use `runtime.thread.reset(initialMessages)`.
     */
    reset: unknown;
};
export declare class AssistantRuntimeImpl implements AssistantRuntime {
    private readonly _core;
    readonly threads: ThreadListRuntimeImpl;
    get threadList(): ThreadListRuntimeImpl;
    readonly _thread: ThreadRuntime;
    constructor(_core: AssistantRuntimeCore);
    protected __internal_bindMethods(): void;
    get thread(): ThreadRuntime;
    switchToNewThread(): Promise<void>;
    switchToThread(threadId: string): Promise<void>;
    registerModelContextProvider(provider: ModelContextProvider): Unsubscribe;
    registerModelConfigProvider(provider: ModelContextProvider): Unsubscribe;
    reset({ initialMessages, }?: {
        initialMessages?: ThreadMessageLike[];
    }): void;
}
//# sourceMappingURL=AssistantRuntime.d.ts.map