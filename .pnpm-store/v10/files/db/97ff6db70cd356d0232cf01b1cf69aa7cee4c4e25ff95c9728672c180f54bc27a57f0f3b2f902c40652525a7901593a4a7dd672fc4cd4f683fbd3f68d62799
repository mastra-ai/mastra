import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { ChatMessageContentItem, ChatMessageContentItem$Outbound } from "./chatmessagecontentitem.js";
import { ChatMessageToolCall, ChatMessageToolCall$Outbound } from "./chatmessagetoolcall.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type AssistantMessageContent = string | Array<ChatMessageContentItem>;
export type AssistantMessage = {
    role: "assistant";
    content?: string | Array<ChatMessageContentItem> | null | undefined;
    name?: string | undefined;
    toolCalls?: Array<ChatMessageToolCall> | undefined;
    refusal?: string | null | undefined;
    reasoning?: string | null | undefined;
};
/** @internal */
export declare const AssistantMessageContent$inboundSchema: z.ZodType<AssistantMessageContent, unknown>;
/** @internal */
export type AssistantMessageContent$Outbound = string | Array<ChatMessageContentItem$Outbound>;
/** @internal */
export declare const AssistantMessageContent$outboundSchema: z.ZodType<AssistantMessageContent$Outbound, AssistantMessageContent>;
export declare function assistantMessageContentToJSON(assistantMessageContent: AssistantMessageContent): string;
export declare function assistantMessageContentFromJSON(jsonString: string): SafeParseResult<AssistantMessageContent, SDKValidationError>;
/** @internal */
export declare const AssistantMessage$inboundSchema: z.ZodType<AssistantMessage, unknown>;
/** @internal */
export type AssistantMessage$Outbound = {
    role: "assistant";
    content?: string | Array<ChatMessageContentItem$Outbound> | null | undefined;
    name?: string | undefined;
    tool_calls?: Array<ChatMessageToolCall$Outbound> | undefined;
    refusal?: string | null | undefined;
    reasoning?: string | null | undefined;
};
/** @internal */
export declare const AssistantMessage$outboundSchema: z.ZodType<AssistantMessage$Outbound, AssistantMessage>;
export declare function assistantMessageToJSON(assistantMessage: AssistantMessage): string;
export declare function assistantMessageFromJSON(jsonString: string): SafeParseResult<AssistantMessage, SDKValidationError>;
//# sourceMappingURL=assistantmessage.d.ts.map