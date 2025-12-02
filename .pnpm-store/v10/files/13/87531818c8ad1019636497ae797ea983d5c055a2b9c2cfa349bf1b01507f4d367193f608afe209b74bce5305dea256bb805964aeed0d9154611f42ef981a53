import { ReadonlyJSONObject } from "assistant-stream/utils";
export type TextMessagePart = {
    readonly type: "text";
    readonly text: string;
    readonly parentId?: string;
};
export type ReasoningMessagePart = {
    readonly type: "reasoning";
    readonly text: string;
    readonly parentId?: string;
};
export type SourceMessagePart = {
    readonly type: "source";
    readonly sourceType: "url";
    readonly id: string;
    readonly url: string;
    readonly title?: string;
    readonly parentId?: string;
};
export type ImageMessagePart = {
    readonly type: "image";
    readonly image: string;
    readonly filename?: string;
};
export type FileMessagePart = {
    readonly type: "file";
    readonly filename?: string;
    readonly data: string;
    readonly mimeType: string;
};
export type Unstable_AudioMessagePart = {
    readonly type: "audio";
    readonly audio: {
        readonly data: string;
        readonly format: "mp3" | "wav";
    };
};
export type ToolCallMessagePart<TArgs = ReadonlyJSONObject, TResult = unknown> = {
    readonly type: "tool-call";
    readonly toolCallId: string;
    readonly toolName: string;
    readonly args: TArgs;
    readonly result?: TResult | undefined;
    readonly isError?: boolean | undefined;
    readonly argsText: string;
    readonly artifact?: unknown;
    readonly parentId?: string;
};
export type ThreadUserMessagePart = TextMessagePart | ImageMessagePart | FileMessagePart | Unstable_AudioMessagePart;
export type ThreadAssistantMessagePart = TextMessagePart | ReasoningMessagePart | ToolCallMessagePart | SourceMessagePart | FileMessagePart | ImageMessagePart;
//# sourceMappingURL=MessagePartTypes.d.ts.map