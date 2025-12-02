import { AddToolResultOptions, StartRunConfig, ThreadSuggestion } from "../core/ThreadRuntimeCore";
import { AppendMessage, ThreadMessage } from "../../types";
import { ExternalStoreAdapter } from "./ExternalStoreAdapter";
import { ThreadMessageLike } from "./ThreadMessageLike";
import { RuntimeCapabilities, ThreadRuntimeCore } from "../core/ThreadRuntimeCore";
import { BaseThreadRuntimeCore } from "../core/BaseThreadRuntimeCore";
import { ModelContextProvider } from "../../model-context";
import { ExportedMessageRepository } from "../utils/MessageRepository";
export declare const hasUpcomingMessage: (isRunning: boolean, messages: readonly ThreadMessage[]) => boolean;
export declare class ExternalStoreThreadRuntimeCore extends BaseThreadRuntimeCore implements ThreadRuntimeCore {
    private _assistantOptimisticId;
    private _capabilities;
    get capabilities(): RuntimeCapabilities;
    private _messages;
    isDisabled: boolean;
    get isLoading(): boolean;
    get messages(): readonly ThreadMessage[];
    get adapters(): {
        attachments?: import("..").AttachmentAdapter | undefined;
        speech?: import("..").SpeechSynthesisAdapter | undefined;
        feedback?: import("..").FeedbackAdapter | undefined;
        threadList?: import("./ExternalStoreAdapter").ExternalStoreThreadListAdapter | undefined;
    } | undefined;
    suggestions: readonly ThreadSuggestion[];
    extras: unknown;
    private _converter;
    private _store;
    beginEdit(messageId: string): void;
    constructor(contextProvider: ModelContextProvider, store: ExternalStoreAdapter<any>);
    __internal_setAdapter(store: ExternalStoreAdapter<any>): void;
    switchToBranch(branchId: string): void;
    append(message: AppendMessage): Promise<void>;
    startRun(config: StartRunConfig): Promise<void>;
    resumeRun(): Promise<void>;
    cancelRun(): void;
    addToolResult(options: AddToolResultOptions): void;
    reset(initialMessages?: readonly ThreadMessageLike[]): void;
    import(data: ExportedMessageRepository): void;
    private updateMessages;
}
//# sourceMappingURL=ExternalStoreThreadRuntimeCore.d.ts.map