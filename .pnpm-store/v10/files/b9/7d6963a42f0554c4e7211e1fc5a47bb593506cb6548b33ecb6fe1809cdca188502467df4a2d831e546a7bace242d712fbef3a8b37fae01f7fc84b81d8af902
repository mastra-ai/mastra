import * as z from "zod/v4";
import { ChatMessageContentItemText, ChatMessageContentItemText$Outbound } from "./chatmessagecontentitemtext.js";
export type SystemMessageContent = string | Array<ChatMessageContentItemText>;
export type SystemMessage = {
    role: "system";
    content: string | Array<ChatMessageContentItemText>;
    name?: string | undefined;
};
/** @internal */
export type SystemMessageContent$Outbound = string | Array<ChatMessageContentItemText$Outbound>;
/** @internal */
export declare const SystemMessageContent$outboundSchema: z.ZodType<SystemMessageContent$Outbound, SystemMessageContent>;
export declare function systemMessageContentToJSON(systemMessageContent: SystemMessageContent): string;
/** @internal */
export type SystemMessage$Outbound = {
    role: "system";
    content: string | Array<ChatMessageContentItemText$Outbound>;
    name?: string | undefined;
};
/** @internal */
export declare const SystemMessage$outboundSchema: z.ZodType<SystemMessage$Outbound, SystemMessage>;
export declare function systemMessageToJSON(systemMessage: SystemMessage): string;
//# sourceMappingURL=systemmessage.d.ts.map