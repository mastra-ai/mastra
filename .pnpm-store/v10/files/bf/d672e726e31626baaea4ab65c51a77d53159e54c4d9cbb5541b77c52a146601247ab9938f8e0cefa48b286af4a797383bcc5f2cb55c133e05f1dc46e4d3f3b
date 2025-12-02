import { ThreadHistoryAdapter } from "../adapters/thread-history/ThreadHistoryAdapter";
import { AttachmentAdapter } from "../adapters/attachment/AttachmentAdapter";
import { ThreadMessageLike } from "../external-store";
import { FeedbackAdapter } from "../adapters/feedback/FeedbackAdapter";
import { SpeechSynthesisAdapter } from "../adapters/speech/SpeechAdapterTypes";
import { ChatModelAdapter } from "./ChatModelAdapter";
import { AssistantCloud } from "assistant-cloud";
import { SuggestionAdapter } from "../adapters";
export type LocalRuntimeOptionsBase = {
    maxSteps?: number | undefined;
    adapters: {
        chatModel: ChatModelAdapter;
        history?: ThreadHistoryAdapter | undefined;
        attachments?: AttachmentAdapter | undefined;
        speech?: SpeechSynthesisAdapter | undefined;
        feedback?: FeedbackAdapter | undefined;
        suggestion?: SuggestionAdapter | undefined;
    };
    /**
     * Names of tools that are allowed to interrupt the run in order to wait for human/external approval.
     */
    unstable_humanToolNames?: string[] | undefined;
};
export type LocalRuntimeOptions = Omit<LocalRuntimeOptionsBase, "adapters"> & {
    cloud?: AssistantCloud | undefined;
    initialMessages?: readonly ThreadMessageLike[] | undefined;
    adapters?: Omit<LocalRuntimeOptionsBase["adapters"], "chatModel"> | undefined;
};
export declare const splitLocalRuntimeOptions: <T extends LocalRuntimeOptions>(options: T) => {
    localRuntimeOptions: {
        cloud: AssistantCloud | undefined;
        initialMessages: readonly ThreadMessageLike[] | undefined;
        maxSteps: number | undefined;
        adapters: Omit<{
            chatModel: ChatModelAdapter;
            history?: ThreadHistoryAdapter | undefined;
            attachments?: AttachmentAdapter | undefined;
            speech?: SpeechSynthesisAdapter | undefined;
            feedback?: FeedbackAdapter | undefined;
            suggestion?: SuggestionAdapter | undefined;
        }, "chatModel"> | undefined;
        unstable_humanToolNames: string[] | undefined;
    };
    otherOptions: Omit<T, "adapters" | "maxSteps" | "unstable_humanToolNames" | "cloud" | "initialMessages">;
};
//# sourceMappingURL=LocalRuntimeOptions.d.ts.map