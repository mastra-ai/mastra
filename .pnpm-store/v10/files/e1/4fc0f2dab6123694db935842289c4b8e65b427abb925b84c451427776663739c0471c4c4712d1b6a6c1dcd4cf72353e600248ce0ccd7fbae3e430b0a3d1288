import { ThreadMessage } from "../types";
import { MessageStatus } from "../types/AssistantTypes";
import { CloudMessage } from "assistant-cloud";
import { ReadonlyJSONObject, ReadonlyJSONValue } from "assistant-stream/utils";
import { ExportedMessageRepositoryItem } from "../runtimes/utils/MessageRepository";
type AuiV0MessageMessagePart = {
    readonly type: "text";
    readonly text: string;
} | {
    readonly type: "reasoning";
    readonly text: string;
} | {
    readonly type: "source";
    readonly sourceType: "url";
    readonly id: string;
    readonly url: string;
    readonly title?: string;
} | {
    readonly type: "tool-call";
    readonly toolCallId: string;
    readonly toolName: string;
    readonly args: ReadonlyJSONObject;
    readonly result?: ReadonlyJSONValue;
    readonly isError?: true;
} | {
    readonly type: "tool-call";
    readonly toolCallId: string;
    readonly toolName: string;
    readonly argsText: string;
    readonly result?: ReadonlyJSONValue;
    readonly isError?: true;
};
type AuiV0Message = {
    readonly role: "assistant" | "user" | "system";
    readonly status?: MessageStatus;
    readonly content: readonly AuiV0MessageMessagePart[];
    readonly metadata: {
        readonly unstable_state?: ReadonlyJSONValue;
        readonly unstable_annotations: readonly ReadonlyJSONValue[];
        readonly unstable_data: readonly ReadonlyJSONValue[];
        readonly steps: readonly {
            readonly usage?: {
                readonly promptTokens: number;
                readonly completionTokens: number;
            };
        }[];
        readonly custom: ReadonlyJSONObject;
    };
};
export declare const auiV0Encode: (message: ThreadMessage) => AuiV0Message;
export declare const auiV0Decode: (cloudMessage: CloudMessage & {
    format: "aui/v0";
}) => ExportedMessageRepositoryItem;
export {};
//# sourceMappingURL=auiV0.d.ts.map