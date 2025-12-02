import { ThreadSuggestion, RuntimeCapabilities, ThreadRuntimeCore, SpeechState, ThreadRuntimeEventType, StartRunConfig, ResumeRunConfig } from "../runtimes/core/ThreadRuntimeCore";
import { ExportedMessageRepository } from "../runtimes/utils/MessageRepository";
import { AppendMessage, ThreadMessage, Unsubscribe } from "../types";
import { ThreadMessageLike } from "../runtimes/external-store";
import { MessageRuntime, MessageRuntimeImpl } from "./MessageRuntime";
import { SubscribableWithState } from "./subscribable/Subscribable";
import { ThreadComposerRuntime, ThreadComposerRuntimeImpl } from "./ComposerRuntime";
import { ThreadListItemRuntimePath, ThreadRuntimePath } from "./RuntimePathTypes";
import type { ThreadListItemState } from "./RuntimeBindings";
import { RunConfig } from "../types/AssistantTypes";
import { ModelContext } from "../model-context";
import { ChatModelRunOptions, ChatModelRunResult } from "../runtimes";
import { ReadonlyJSONValue } from "assistant-stream/utils";
export type CreateStartRunConfig = {
    parentId: string | null;
    sourceId?: string | null | undefined;
    runConfig?: RunConfig | undefined;
};
export type CreateResumeRunConfig = CreateStartRunConfig & {
    stream: (options: ChatModelRunOptions) => AsyncGenerator<ChatModelRunResult, void, unknown>;
};
export type CreateAppendMessage = string | {
    parentId?: string | null | undefined;
    sourceId?: string | null | undefined;
    role?: AppendMessage["role"] | undefined;
    content: AppendMessage["content"];
    attachments?: AppendMessage["attachments"] | undefined;
    metadata?: AppendMessage["metadata"] | undefined;
    createdAt?: Date | undefined;
    runConfig?: AppendMessage["runConfig"] | undefined;
    startRun?: boolean | undefined;
};
export type ThreadRuntimeCoreBinding = SubscribableWithState<ThreadRuntimeCore, ThreadRuntimePath> & {
    outerSubscribe(callback: () => void): Unsubscribe;
};
export type ThreadListItemRuntimeBinding = SubscribableWithState<ThreadListItemState, ThreadListItemRuntimePath>;
export type ThreadState = {
    /**
     * The thread ID.
     * @deprecated This field is deprecated and will be removed in 0.8.0. Use `useThreadListItem().id` instead.
     */
    readonly threadId: string;
    /**
     * The thread metadata.
     *
     * @deprecated Use `useThreadListItem()` instead. This field is deprecated and will be removed in 0.8.0.
     */
    readonly metadata: ThreadListItemState;
    /**
     * Whether the thread is disabled. Disabled threads cannot receive new messages.
     */
    readonly isDisabled: boolean;
    /**
     * Whether the thread is loading its history.
     */
    readonly isLoading: boolean;
    /**
     * Whether the thread is running. A thread is considered running when there is an active stream connection to the backend.
     */
    readonly isRunning: boolean;
    /**
     * The capabilities of the thread, such as whether the thread supports editing, branch switching, etc.
     */
    readonly capabilities: RuntimeCapabilities;
    /**
     * The messages in the currently selected branch of the thread.
     */
    readonly messages: readonly ThreadMessage[];
    /**
     * The thread state.
     *
     * @deprecated This feature is experimental
     */
    readonly state: ReadonlyJSONValue;
    /**
     * Follow up message suggestions to show the user.
     */
    readonly suggestions: readonly ThreadSuggestion[];
    /**
     * Custom extra information provided by the runtime.
     */
    readonly extras: unknown;
    /**
     * @deprecated This API is still under active development and might change without notice.
     */
    readonly speech: SpeechState | undefined;
};
export declare const getThreadState: (runtime: ThreadRuntimeCore, threadListItemState: ThreadListItemState) => ThreadState;
export type ThreadRuntime = {
    /**
     * The selector for the thread runtime.
     */
    readonly path: ThreadRuntimePath;
    /**
     * The thread composer runtime.
     */
    readonly composer: ThreadComposerRuntime;
    /**
     * Gets a snapshot of the thread state.
     */
    getState(): ThreadState;
    /**
     * Append a new message to the thread.
     *
     * @example ```ts
     * // append a new user message with the text "Hello, world!"
     * threadRuntime.append("Hello, world!");
     * ```
     *
     * @example ```ts
     * // append a new assistant message with the text "Hello, world!"
     * threadRuntime.append({
     *   role: "assistant",
     *   content: [{ type: "text", text: "Hello, world!" }],
     * });
     * ```
     */
    append(message: CreateAppendMessage): void;
    /**
     * @deprecated pass an object with `parentId` instead. This will be removed in 0.8.0.
     */
    startRun(parentId: string | null): void;
    /**
     * Start a new run with the given configuration.
     * @param config The configuration for starting the run
     */
    startRun(config: CreateStartRunConfig): void;
    /**
     * Resume a run with the given configuration.
     * @param config The configuration for resuming the run
     **/
    unstable_resumeRun(config: CreateResumeRunConfig): void;
    subscribe(callback: () => void): Unsubscribe;
    cancelRun(): void;
    getModelContext(): ModelContext;
    /**
     * @deprecated This method was renamed to `getModelContext`.
     */
    getModelConfig(): ModelContext;
    export(): ExportedMessageRepository;
    import(repository: ExportedMessageRepository): void;
    /**
     * Reset the thread with optional initial messages.
     *
     * @param initialMessages - Optional array of initial messages to populate the thread
     */
    reset(initialMessages?: readonly ThreadMessageLike[]): void;
    getMesssageByIndex(idx: number): MessageRuntime;
    getMesssageById(messageId: string): MessageRuntime;
    /**
     * @deprecated This API is still under active development and might change without notice.
     */
    stopSpeaking: () => void;
    unstable_on(event: ThreadRuntimeEventType, callback: () => void): Unsubscribe;
};
export declare class ThreadRuntimeImpl implements ThreadRuntime {
    get path(): ThreadRuntimePath;
    get __internal_threadBinding(): import("./subscribable/Subscribable").Subscribable & {
        path: ThreadRuntimePath;
        getState: () => Readonly<{
            getMessageById: (messageId: string) => {
                parentId: string | null;
                message: ThreadMessage;
            } | undefined;
            getBranches: (messageId: string) => readonly string[];
            switchToBranch: (branchId: string) => void;
            append: (message: AppendMessage) => void;
            startRun: (config: StartRunConfig) => void;
            resumeRun: (config: ResumeRunConfig) => void;
            cancelRun: () => void;
            addToolResult: (options: import("..").AddToolResultOptions) => void;
            speak: (messageId: string) => void;
            stopSpeaking: () => void;
            getSubmittedFeedback: (messageId: string) => import("../runtimes/core/ThreadRuntimeCore").SubmittedFeedback | undefined;
            submitFeedback: (feedback: import("..").SubmitFeedbackOptions) => void;
            getModelContext: () => ModelContext;
            composer: import("../runtimes/core/ComposerRuntimeCore").ThreadComposerRuntimeCore;
            getEditComposer: (messageId: string) => Readonly<{
                isEditing: boolean;
                canCancel: boolean;
                isEmpty: boolean;
                attachments: readonly import("..").Attachment[];
                getAttachmentAccept(): string;
                addAttachment: (file: File) => Promise<void>;
                removeAttachment: (attachmentId: string) => Promise<void>;
                text: string;
                setText: (value: string) => void;
                role: import("../types/AssistantTypes").MessageRole;
                setRole: (role: import("../types/AssistantTypes").MessageRole) => void;
                runConfig: RunConfig;
                setRunConfig: (runConfig: RunConfig) => void;
                reset: () => Promise<void>;
                clearAttachments: () => Promise<void>;
                send: () => void;
                cancel: () => void;
                subscribe: (callback: () => void) => Unsubscribe;
                unstable_on: (event: import("../runtimes/core/ComposerRuntimeCore").ComposerRuntimeEventType, callback: () => void) => Unsubscribe;
            }> | undefined;
            beginEdit: (messageId: string) => void;
            speech: SpeechState | undefined;
            capabilities: Readonly<RuntimeCapabilities>;
            isDisabled: boolean;
            isLoading: boolean;
            messages: readonly ThreadMessage[];
            state: ReadonlyJSONValue;
            suggestions: readonly ThreadSuggestion[];
            extras: unknown;
            subscribe: (callback: () => void) => Unsubscribe;
            import(repository: ExportedMessageRepository): void;
            export(): ExportedMessageRepository;
            reset(initialMessages?: readonly ThreadMessageLike[]): void;
            unstable_on(event: ThreadRuntimeEventType, callback: () => void): Unsubscribe;
        }>;
    } & {
        outerSubscribe(callback: () => void): Unsubscribe;
    } & {
        getStateState(): ThreadState;
    };
    private readonly _threadBinding;
    constructor(threadBinding: ThreadRuntimeCoreBinding, threadListItemBinding: ThreadListItemRuntimeBinding);
    protected __internal_bindMethods(): void;
    readonly composer: ThreadComposerRuntimeImpl;
    getState(): ThreadState;
    append(message: CreateAppendMessage): void;
    subscribe(callback: () => void): Unsubscribe;
    getModelContext(): ModelContext;
    getModelConfig(): ModelContext;
    startRun(configOrParentId: string | null | CreateStartRunConfig): void;
    unstable_resumeRun(config: CreateResumeRunConfig): void;
    cancelRun(): void;
    stopSpeaking(): void;
    export(): ExportedMessageRepository;
    import(data: ExportedMessageRepository): void;
    reset(initialMessages?: readonly ThreadMessageLike[]): void;
    getMesssageByIndex(idx: number): MessageRuntimeImpl;
    getMesssageById(messageId: string): MessageRuntimeImpl;
    private _getMessageRuntime;
    private _eventSubscriptionSubjects;
    unstable_on(event: ThreadRuntimeEventType, callback: () => void): Unsubscribe;
}
//# sourceMappingURL=ThreadRuntime.d.ts.map