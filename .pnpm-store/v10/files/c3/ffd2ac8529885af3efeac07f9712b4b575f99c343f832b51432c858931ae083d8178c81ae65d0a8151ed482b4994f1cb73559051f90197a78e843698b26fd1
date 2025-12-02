import type { AppendMessage } from "../../types";
import type { ChatModelAdapter } from "./ChatModelAdapter";
import { LocalRuntimeOptionsBase } from "./LocalRuntimeOptions";
import { AddToolResultOptions, ThreadSuggestion, ThreadRuntimeCore, StartRunConfig, ResumeRunConfig } from "../core/ThreadRuntimeCore";
import { BaseThreadRuntimeCore } from "../core/BaseThreadRuntimeCore";
import { ModelContextProvider } from "../../model-context";
export declare class LocalThreadRuntimeCore extends BaseThreadRuntimeCore implements ThreadRuntimeCore {
    readonly capabilities: {
        switchToBranch: boolean;
        edit: boolean;
        reload: boolean;
        cancel: boolean;
        unstable_copy: boolean;
        speech: boolean;
        attachments: boolean;
        feedback: boolean;
    };
    private abortController;
    readonly isDisabled = false;
    private _isLoading;
    get isLoading(): boolean;
    private _suggestions;
    private _suggestionsController;
    get suggestions(): readonly ThreadSuggestion[];
    get adapters(): {
        chatModel: ChatModelAdapter;
        history?: import("..").ThreadHistoryAdapter | undefined;
        attachments?: import("..").AttachmentAdapter | undefined;
        speech?: import("..").SpeechSynthesisAdapter | undefined;
        feedback?: import("..").FeedbackAdapter | undefined;
        suggestion?: import("..").SuggestionAdapter | undefined;
    };
    constructor(contextProvider: ModelContextProvider, options: LocalRuntimeOptionsBase);
    private _options;
    private _lastRunConfig;
    get extras(): undefined;
    __internal_setOptions(options: LocalRuntimeOptionsBase): void;
    private _loadPromise;
    __internal_load(): Promise<void>;
    append(message: AppendMessage): Promise<void>;
    resumeRun({ stream, ...startConfig }: ResumeRunConfig): Promise<void>;
    startRun({ parentId, runConfig }: StartRunConfig, runCallback?: ChatModelAdapter["run"]): Promise<void>;
    private performRoundtrip;
    detach(): void;
    cancelRun(): void;
    addToolResult({ messageId, toolCallId, result, isError, artifact, }: AddToolResultOptions): void;
}
//# sourceMappingURL=LocalThreadRuntimeCore.d.ts.map