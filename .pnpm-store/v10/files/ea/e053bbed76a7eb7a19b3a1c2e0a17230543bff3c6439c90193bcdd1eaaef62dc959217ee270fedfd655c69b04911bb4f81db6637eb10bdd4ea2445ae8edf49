import * as z from "zod/v4";
import { AssistantMessage, AssistantMessage$Outbound } from "./assistantmessage.js";
import { ChatMessageContentItemText, ChatMessageContentItemText$Outbound } from "./chatmessagecontentitemtext.js";
import { SystemMessage, SystemMessage$Outbound } from "./systemmessage.js";
import { ToolResponseMessage, ToolResponseMessage$Outbound } from "./toolresponsemessage.js";
import { UserMessage, UserMessage$Outbound } from "./usermessage.js";
export type MessageContent = string | Array<ChatMessageContentItemText>;
export type MessageDeveloper = {
    role: "developer";
    content: string | Array<ChatMessageContentItemText>;
    name?: string | undefined;
};
export type Message = ToolResponseMessage | SystemMessage | UserMessage | MessageDeveloper | AssistantMessage;
/** @internal */
export type MessageContent$Outbound = string | Array<ChatMessageContentItemText$Outbound>;
/** @internal */
export declare const MessageContent$outboundSchema: z.ZodType<MessageContent$Outbound, MessageContent>;
export declare function messageContentToJSON(messageContent: MessageContent): string;
/** @internal */
export type MessageDeveloper$Outbound = {
    role: "developer";
    content: string | Array<ChatMessageContentItemText$Outbound>;
    name?: string | undefined;
};
/** @internal */
export declare const MessageDeveloper$outboundSchema: z.ZodType<MessageDeveloper$Outbound, MessageDeveloper>;
export declare function messageDeveloperToJSON(messageDeveloper: MessageDeveloper): string;
/** @internal */
export type Message$Outbound = ToolResponseMessage$Outbound | SystemMessage$Outbound | UserMessage$Outbound | MessageDeveloper$Outbound | AssistantMessage$Outbound;
/** @internal */
export declare const Message$outboundSchema: z.ZodType<Message$Outbound, Message>;
export declare function messageToJSON(message: Message): string;
//# sourceMappingURL=message.d.ts.map