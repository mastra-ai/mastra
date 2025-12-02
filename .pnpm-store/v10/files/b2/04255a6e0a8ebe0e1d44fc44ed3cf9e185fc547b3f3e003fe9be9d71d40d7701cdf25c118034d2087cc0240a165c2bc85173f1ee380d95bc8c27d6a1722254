import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type ChatStreamingMessageToolCallFunction = {
    name?: string | undefined;
    arguments?: string | undefined;
};
export type ChatStreamingMessageToolCall = {
    index: number;
    id?: string | undefined;
    type?: "function" | undefined;
    function?: ChatStreamingMessageToolCallFunction | undefined;
};
/** @internal */
export declare const ChatStreamingMessageToolCallFunction$inboundSchema: z.ZodType<ChatStreamingMessageToolCallFunction, unknown>;
export declare function chatStreamingMessageToolCallFunctionFromJSON(jsonString: string): SafeParseResult<ChatStreamingMessageToolCallFunction, SDKValidationError>;
/** @internal */
export declare const ChatStreamingMessageToolCall$inboundSchema: z.ZodType<ChatStreamingMessageToolCall, unknown>;
export declare function chatStreamingMessageToolCallFromJSON(jsonString: string): SafeParseResult<ChatStreamingMessageToolCall, SDKValidationError>;
//# sourceMappingURL=chatstreamingmessagetoolcall.d.ts.map