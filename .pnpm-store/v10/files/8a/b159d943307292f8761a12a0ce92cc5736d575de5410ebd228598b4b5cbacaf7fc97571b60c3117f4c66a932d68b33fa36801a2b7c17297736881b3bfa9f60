import * as z from "zod/v4";
import { ChatMessageContentItem, ChatMessageContentItem$Outbound } from "./chatmessagecontentitem.js";
export type UserMessageContent = string | Array<ChatMessageContentItem>;
export type UserMessage = {
    role: "user";
    content: string | Array<ChatMessageContentItem>;
    name?: string | undefined;
};
/** @internal */
export type UserMessageContent$Outbound = string | Array<ChatMessageContentItem$Outbound>;
/** @internal */
export declare const UserMessageContent$outboundSchema: z.ZodType<UserMessageContent$Outbound, UserMessageContent>;
export declare function userMessageContentToJSON(userMessageContent: UserMessageContent): string;
/** @internal */
export type UserMessage$Outbound = {
    role: "user";
    content: string | Array<ChatMessageContentItem$Outbound>;
    name?: string | undefined;
};
/** @internal */
export declare const UserMessage$outboundSchema: z.ZodType<UserMessage$Outbound, UserMessage>;
export declare function userMessageToJSON(userMessage: UserMessage): string;
//# sourceMappingURL=usermessage.d.ts.map