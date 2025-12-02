import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type ChatMessageContentItemText = {
    type: "text";
    text: string;
};
/** @internal */
export declare const ChatMessageContentItemText$inboundSchema: z.ZodType<ChatMessageContentItemText, unknown>;
/** @internal */
export type ChatMessageContentItemText$Outbound = {
    type: "text";
    text: string;
};
/** @internal */
export declare const ChatMessageContentItemText$outboundSchema: z.ZodType<ChatMessageContentItemText$Outbound, ChatMessageContentItemText>;
export declare function chatMessageContentItemTextToJSON(chatMessageContentItemText: ChatMessageContentItemText): string;
export declare function chatMessageContentItemTextFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemText, SDKValidationError>;
//# sourceMappingURL=chatmessagecontentitemtext.d.ts.map