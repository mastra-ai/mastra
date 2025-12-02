import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type ChatMessageToolCallFunction = {
    name: string;
    arguments: string;
};
export type ChatMessageToolCall = {
    id: string;
    type: "function";
    function: ChatMessageToolCallFunction;
};
/** @internal */
export declare const ChatMessageToolCallFunction$inboundSchema: z.ZodType<ChatMessageToolCallFunction, unknown>;
/** @internal */
export type ChatMessageToolCallFunction$Outbound = {
    name: string;
    arguments: string;
};
/** @internal */
export declare const ChatMessageToolCallFunction$outboundSchema: z.ZodType<ChatMessageToolCallFunction$Outbound, ChatMessageToolCallFunction>;
export declare function chatMessageToolCallFunctionToJSON(chatMessageToolCallFunction: ChatMessageToolCallFunction): string;
export declare function chatMessageToolCallFunctionFromJSON(jsonString: string): SafeParseResult<ChatMessageToolCallFunction, SDKValidationError>;
/** @internal */
export declare const ChatMessageToolCall$inboundSchema: z.ZodType<ChatMessageToolCall, unknown>;
/** @internal */
export type ChatMessageToolCall$Outbound = {
    id: string;
    type: "function";
    function: ChatMessageToolCallFunction$Outbound;
};
/** @internal */
export declare const ChatMessageToolCall$outboundSchema: z.ZodType<ChatMessageToolCall$Outbound, ChatMessageToolCall>;
export declare function chatMessageToolCallToJSON(chatMessageToolCall: ChatMessageToolCall): string;
export declare function chatMessageToolCallFromJSON(jsonString: string): SafeParseResult<ChatMessageToolCall, SDKValidationError>;
//# sourceMappingURL=chatmessagetoolcall.d.ts.map