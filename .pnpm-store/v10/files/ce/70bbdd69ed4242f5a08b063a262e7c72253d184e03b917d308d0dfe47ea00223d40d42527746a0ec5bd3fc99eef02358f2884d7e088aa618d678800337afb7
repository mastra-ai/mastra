import { FC, PropsWithChildren, ComponentType } from "react";
import { BaseSubscribable } from "./BaseSubscribable";
import { AssistantRuntime } from "../../api";
type RemoteThreadListHook = () => AssistantRuntime;
export declare class RemoteThreadListHookInstanceManager extends BaseSubscribable {
    private useRuntimeHook;
    private instances;
    private useAliveThreadsKeysChanged;
    constructor(runtimeHook: RemoteThreadListHook);
    startThreadRuntime(threadId: string): Promise<Readonly<{
        getMessageById: (messageId: string) => {
            parentId: string | null;
            message: import("../..").ThreadMessage;
        } | undefined;
        getBranches: (messageId: string) => readonly string[];
        switchToBranch: (branchId: string) => void;
        append: (message: import("../..").AppendMessage) => void;
        startRun: (config: import("../core/ThreadRuntimeCore").StartRunConfig) => void;
        resumeRun: (config: import("../core/ThreadRuntimeCore").ResumeRunConfig) => void;
        cancelRun: () => void;
        addToolResult: (options: import("..").AddToolResultOptions) => void;
        speak: (messageId: string) => void;
        stopSpeaking: () => void;
        getSubmittedFeedback: (messageId: string) => import("../core/ThreadRuntimeCore").SubmittedFeedback | undefined;
        submitFeedback: (feedback: import("..").SubmitFeedbackOptions) => void;
        getModelContext: () => import("../..").AssistantConfig;
        composer: import("../core/ComposerRuntimeCore").ThreadComposerRuntimeCore;
        getEditComposer: (messageId: string) => import("../core/ComposerRuntimeCore").ComposerRuntimeCore | undefined;
        beginEdit: (messageId: string) => void;
        speech: import("../core/ThreadRuntimeCore").SpeechState | undefined;
        capabilities: Readonly<import("../core/ThreadRuntimeCore").RuntimeCapabilities>;
        isDisabled: boolean;
        isLoading: boolean;
        messages: readonly import("../..").ThreadMessage[];
        state: import("assistant-stream/utils").ReadonlyJSONValue;
        suggestions: readonly import("..").ThreadSuggestion[];
        extras: unknown;
        subscribe: (callback: () => void) => import("../..").Unsubscribe;
        import(repository: import("..").ExportedMessageRepository): void;
        export(): import("..").ExportedMessageRepository;
        reset(initialMessages?: readonly import("..").ThreadMessageLike[]): void;
        unstable_on(event: import("../core/ThreadRuntimeCore").ThreadRuntimeEventType, callback: () => void): import("../..").Unsubscribe;
    }>>;
    getThreadRuntimeCore(threadId: string): Readonly<{
        getMessageById: (messageId: string) => {
            parentId: string | null;
            message: import("../..").ThreadMessage;
        } | undefined;
        getBranches: (messageId: string) => readonly string[];
        switchToBranch: (branchId: string) => void;
        append: (message: import("../..").AppendMessage) => void;
        startRun: (config: import("../core/ThreadRuntimeCore").StartRunConfig) => void;
        resumeRun: (config: import("../core/ThreadRuntimeCore").ResumeRunConfig) => void;
        cancelRun: () => void;
        addToolResult: (options: import("..").AddToolResultOptions) => void;
        speak: (messageId: string) => void;
        stopSpeaking: () => void;
        getSubmittedFeedback: (messageId: string) => import("../core/ThreadRuntimeCore").SubmittedFeedback | undefined;
        submitFeedback: (feedback: import("..").SubmitFeedbackOptions) => void;
        getModelContext: () => import("../..").AssistantConfig;
        composer: import("../core/ComposerRuntimeCore").ThreadComposerRuntimeCore;
        getEditComposer: (messageId: string) => import("../core/ComposerRuntimeCore").ComposerRuntimeCore | undefined;
        beginEdit: (messageId: string) => void;
        speech: import("../core/ThreadRuntimeCore").SpeechState | undefined;
        capabilities: Readonly<import("../core/ThreadRuntimeCore").RuntimeCapabilities>;
        isDisabled: boolean;
        isLoading: boolean;
        messages: readonly import("../..").ThreadMessage[];
        state: import("assistant-stream/utils").ReadonlyJSONValue;
        suggestions: readonly import("..").ThreadSuggestion[];
        extras: unknown;
        subscribe: (callback: () => void) => import("../..").Unsubscribe;
        import(repository: import("..").ExportedMessageRepository): void;
        export(): import("..").ExportedMessageRepository;
        reset(initialMessages?: readonly import("..").ThreadMessageLike[]): void;
        unstable_on(event: import("../core/ThreadRuntimeCore").ThreadRuntimeEventType, callback: () => void): import("../..").Unsubscribe;
    }> | undefined;
    stopThreadRuntime(threadId: string): void;
    setRuntimeHook(newRuntimeHook: RemoteThreadListHook): void;
    private _InnerActiveThreadProvider;
    private _OuterActiveThreadProvider;
    __internal_RenderThreadRuntimes: FC<{
        provider: ComponentType<PropsWithChildren>;
    }>;
}
export {};
//# sourceMappingURL=RemoteThreadListHookInstanceManager.d.ts.map