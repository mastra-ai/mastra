import * as z from "zod/v4";
import { ChatMessageContentItem, ChatMessageContentItem$Outbound } from "./chatmessagecontentitem.js";
export type ToolResponseMessageContent = string | Array<ChatMessageContentItem>;
export type ToolResponseMessage = {
    role: "tool";
    content: string | Array<ChatMessageContentItem>;
    toolCallId: string;
};
/** @internal */
export type ToolResponseMessageContent$Outbound = string | Array<ChatMessageContentItem$Outbound>;
/** @internal */
export declare const ToolResponseMessageContent$outboundSchema: z.ZodType<ToolResponseMessageContent$Outbound, ToolResponseMessageContent>;
export declare function toolResponseMessageContentToJSON(toolResponseMessageContent: ToolResponseMessageContent): string;
/** @internal */
export type ToolResponseMessage$Outbound = {
    role: "tool";
    content: string | Array<ChatMessageContentItem$Outbound>;
    tool_call_id: string;
};
/** @internal */
export declare const ToolResponseMessage$outboundSchema: z.ZodType<ToolResponseMessage$Outbound, ToolResponseMessage>;
export declare function toolResponseMessageToJSON(toolResponseMessage: ToolResponseMessage): string;
//# sourceMappingURL=toolresponsemessage.d.ts.map