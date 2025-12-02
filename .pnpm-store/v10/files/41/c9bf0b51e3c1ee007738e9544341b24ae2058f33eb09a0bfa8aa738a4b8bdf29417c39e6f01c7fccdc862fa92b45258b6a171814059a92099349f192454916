import { MessageStatus, TextMessagePart, ImageMessagePart, ThreadMessage, CompleteAttachment, FileMessagePart, Unstable_AudioMessagePart } from "../../types";
import { ReasoningMessagePart, SourceMessagePart, ThreadStep } from "../../types/AssistantTypes";
import { ReadonlyJSONObject, ReadonlyJSONValue } from "assistant-stream/utils";
export type ThreadMessageLike = {
    readonly role: "assistant" | "user" | "system";
    readonly content: string | readonly (TextMessagePart | ReasoningMessagePart | SourceMessagePart | ImageMessagePart | FileMessagePart | Unstable_AudioMessagePart | {
        readonly type: "tool-call";
        readonly toolCallId?: string;
        readonly toolName: string;
        readonly args?: ReadonlyJSONObject;
        readonly argsText?: string;
        readonly artifact?: any;
        readonly result?: any | undefined;
        readonly isError?: boolean | undefined;
        readonly parentId?: string | undefined;
    })[];
    readonly id?: string | undefined;
    readonly createdAt?: Date | undefined;
    readonly status?: MessageStatus | undefined;
    readonly attachments?: readonly CompleteAttachment[] | undefined;
    readonly metadata?: {
        readonly unstable_state?: ReadonlyJSONValue;
        readonly unstable_annotations?: readonly ReadonlyJSONValue[] | undefined;
        readonly unstable_data?: readonly ReadonlyJSONValue[] | undefined;
        readonly steps?: readonly ThreadStep[] | undefined;
        readonly custom?: Record<string, unknown> | undefined;
    } | undefined;
};
export declare const fromThreadMessageLike: (like: ThreadMessageLike, fallbackId: string, fallbackStatus: MessageStatus) => ThreadMessage;
//# sourceMappingURL=ThreadMessageLike.d.ts.map