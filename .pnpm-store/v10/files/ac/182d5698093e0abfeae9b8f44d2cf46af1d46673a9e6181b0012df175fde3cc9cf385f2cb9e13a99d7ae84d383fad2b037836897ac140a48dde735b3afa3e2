import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { AssistantMessage } from "./assistantmessage.js";
import { ChatMessageTokenLogprobs } from "./chatmessagetokenlogprobs.js";
import { ChatStreamingMessageChunk } from "./chatstreamingmessagechunk.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ChatCompletionFinishReason: {
    readonly ToolCalls: "tool_calls";
    readonly Stop: "stop";
    readonly Length: "length";
    readonly ContentFilter: "content_filter";
    readonly Error: "error";
};
export type ChatCompletionFinishReason = OpenEnum<typeof ChatCompletionFinishReason>;
export type ChatResponseChoice = {
    finishReason: ChatCompletionFinishReason | null;
    index: number;
    message: AssistantMessage;
    logprobs?: ChatMessageTokenLogprobs | null | undefined;
};
export type ChatStreamingChoice = {
    delta: ChatStreamingMessageChunk;
    finishReason: ChatCompletionFinishReason | null;
    index: number;
    logprobs?: ChatMessageTokenLogprobs | null | undefined;
};
/** @internal */
export declare const ChatCompletionFinishReason$inboundSchema: z.ZodType<ChatCompletionFinishReason, unknown>;
/** @internal */
export declare const ChatResponseChoice$inboundSchema: z.ZodType<ChatResponseChoice, unknown>;
export declare function chatResponseChoiceFromJSON(jsonString: string): SafeParseResult<ChatResponseChoice, SDKValidationError>;
/** @internal */
export declare const ChatStreamingChoice$inboundSchema: z.ZodType<ChatStreamingChoice, unknown>;
export declare function chatStreamingChoiceFromJSON(jsonString: string): SafeParseResult<ChatStreamingChoice, SDKValidationError>;
//# sourceMappingURL=chatresponsechoice.d.ts.map