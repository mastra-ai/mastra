import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { ChatMessageContentItemAudio, ChatMessageContentItemAudio$Outbound } from "./chatmessagecontentitemaudio.js";
import { ChatMessageContentItemFile, ChatMessageContentItemFile$Outbound } from "./chatmessagecontentitemfile.js";
import { ChatMessageContentItemImage, ChatMessageContentItemImage$Outbound } from "./chatmessagecontentitemimage.js";
import { ChatMessageContentItemText, ChatMessageContentItemText$Outbound } from "./chatmessagecontentitemtext.js";
import { ChatMessageContentItemVideo, ChatMessageContentItemVideo$Outbound } from "./chatmessagecontentitemvideo.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type ChatMessageContentItem = (ChatMessageContentItemText & {
    type: "text";
}) | (ChatMessageContentItemImage & {
    type: "image_url";
}) | (ChatMessageContentItemAudio & {
    type: "input_audio";
}) | (ChatMessageContentItemFile & {
    type: "file";
}) | (ChatMessageContentItemVideo & {
    type: "input_video";
}) | (ChatMessageContentItemVideo & {
    type: "video_url";
});
/** @internal */
export declare const ChatMessageContentItem$inboundSchema: z.ZodType<ChatMessageContentItem, unknown>;
/** @internal */
export type ChatMessageContentItem$Outbound = (ChatMessageContentItemText$Outbound & {
    type: "text";
}) | (ChatMessageContentItemImage$Outbound & {
    type: "image_url";
}) | (ChatMessageContentItemAudio$Outbound & {
    type: "input_audio";
}) | (ChatMessageContentItemFile$Outbound & {
    type: "file";
}) | (ChatMessageContentItemVideo$Outbound & {
    type: "input_video";
}) | (ChatMessageContentItemVideo$Outbound & {
    type: "video_url";
});
/** @internal */
export declare const ChatMessageContentItem$outboundSchema: z.ZodType<ChatMessageContentItem$Outbound, ChatMessageContentItem>;
export declare function chatMessageContentItemToJSON(chatMessageContentItem: ChatMessageContentItem): string;
export declare function chatMessageContentItemFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItem, SDKValidationError>;
//# sourceMappingURL=chatmessagecontentitem.d.ts.map