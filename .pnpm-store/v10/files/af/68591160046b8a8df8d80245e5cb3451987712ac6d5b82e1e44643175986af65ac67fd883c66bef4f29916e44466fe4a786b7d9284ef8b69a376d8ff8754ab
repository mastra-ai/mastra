import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { ChatStreamingMessageToolCall } from "./chatstreamingmessagetoolcall.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ChatStreamingMessageChunkRole: {
    readonly Assistant: "assistant";
};
export type ChatStreamingMessageChunkRole = ClosedEnum<typeof ChatStreamingMessageChunkRole>;
export type ChatStreamingMessageChunk = {
    role?: ChatStreamingMessageChunkRole | undefined;
    content?: string | null | undefined;
    reasoning?: string | null | undefined;
    refusal?: string | null | undefined;
    toolCalls?: Array<ChatStreamingMessageToolCall> | undefined;
};
/** @internal */
export declare const ChatStreamingMessageChunkRole$inboundSchema: z.ZodEnum<typeof ChatStreamingMessageChunkRole>;
/** @internal */
export declare const ChatStreamingMessageChunk$inboundSchema: z.ZodType<ChatStreamingMessageChunk, unknown>;
export declare function chatStreamingMessageChunkFromJSON(jsonString: string): SafeParseResult<ChatStreamingMessageChunk, SDKValidationError>;
//# sourceMappingURL=chatstreamingmessagechunk.d.ts.map