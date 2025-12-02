import { ReadonlyJSONObject, ReadonlyJSONValue } from "../../../utils/json/json-value";
import { ObjectStreamOperation } from "../../object/types";
export type DataStreamChunk = {
    [K in DataStreamStreamChunkType]: {
        type: K;
        value: DataStreamStreamChunkValue[K];
    };
}[DataStreamStreamChunkType];
type LanguageModelV1FinishReason = "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other" | "unknown";
type LanguageModelV1Usage = {
    promptTokens: number;
    completionTokens: number;
};
export declare enum DataStreamStreamChunkType {
    TextDelta = "0",
    Data = "2",
    Error = "3",
    Annotation = "8",
    ToolCall = "9",
    ToolCallResult = "a",
    StartToolCall = "b",
    ToolCallArgsTextDelta = "c",
    FinishMessage = "d",
    FinishStep = "e",
    StartStep = "f",
    ReasoningDelta = "g",
    Source = "h",
    RedactedReasoning = "i",
    ReasoningSignature = "j",
    File = "k",
    AuiUpdateStateOperations = "aui-state",
    AuiTextDelta = "aui-text-delta",
    AuiReasoningDelta = "aui-reasoning-delta"
}
type DataStreamStreamChunkValue = {
    [DataStreamStreamChunkType.TextDelta]: string;
    [DataStreamStreamChunkType.Data]: ReadonlyJSONValue[];
    [DataStreamStreamChunkType.Annotation]: ReadonlyJSONValue[];
    [DataStreamStreamChunkType.ToolCall]: {
        toolCallId: string;
        toolName: string;
        args: ReadonlyJSONObject;
    };
    [DataStreamStreamChunkType.StartToolCall]: {
        toolCallId: string;
        toolName: string;
        parentId?: string;
    };
    [DataStreamStreamChunkType.ToolCallArgsTextDelta]: {
        toolCallId: string;
        argsTextDelta: string;
    };
    [DataStreamStreamChunkType.ToolCallResult]: {
        toolCallId: string;
        result: ReadonlyJSONValue;
        artifact?: ReadonlyJSONValue | undefined;
        isError?: boolean;
    };
    [DataStreamStreamChunkType.Error]: string;
    [DataStreamStreamChunkType.FinishStep]: {
        finishReason: LanguageModelV1FinishReason;
        usage: LanguageModelV1Usage;
        isContinued: boolean;
    };
    [DataStreamStreamChunkType.FinishMessage]: {
        finishReason: LanguageModelV1FinishReason;
        usage: LanguageModelV1Usage;
    };
    [DataStreamStreamChunkType.StartStep]: {
        messageId: string;
    };
    [DataStreamStreamChunkType.ReasoningDelta]: string;
    [DataStreamStreamChunkType.Source]: {
        sourceType: "url";
        id: string;
        url: string;
        title?: string;
        parentId?: string;
    };
    [DataStreamStreamChunkType.RedactedReasoning]: {
        data: string;
    };
    [DataStreamStreamChunkType.ReasoningSignature]: {
        signature: string;
    };
    [DataStreamStreamChunkType.File]: {
        data: string;
        mimeType: string;
    };
    [DataStreamStreamChunkType.AuiUpdateStateOperations]: ObjectStreamOperation[];
    [DataStreamStreamChunkType.AuiTextDelta]: {
        textDelta: string;
        parentId: string;
    };
    [DataStreamStreamChunkType.AuiReasoningDelta]: {
        reasoningDelta: string;
        parentId: string;
    };
};
export {};
//# sourceMappingURL=chunk-types.d.ts.map