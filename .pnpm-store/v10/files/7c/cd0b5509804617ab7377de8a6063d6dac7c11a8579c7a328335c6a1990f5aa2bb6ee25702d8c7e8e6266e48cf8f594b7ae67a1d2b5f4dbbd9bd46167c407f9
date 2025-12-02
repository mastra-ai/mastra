import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { VideoURL, VideoURL$Outbound } from "./videourl.js";
export type ChatMessageContentItemVideoVideoUrlVideoUrl = {
    url: string;
};
export type ChatMessageContentItemVideoVideoURL = {
    type: "video_url";
    videoUrl: ChatMessageContentItemVideoVideoUrlVideoUrl;
};
export type ChatMessageContentItemVideoInputVideo = {
    type: "input_video";
    videoUrl: VideoURL;
};
export type ChatMessageContentItemVideo = ChatMessageContentItemVideoInputVideo | ChatMessageContentItemVideoVideoURL;
/** @internal */
export declare const ChatMessageContentItemVideoVideoUrlVideoUrl$inboundSchema: z.ZodType<ChatMessageContentItemVideoVideoUrlVideoUrl, unknown>;
/** @internal */
export type ChatMessageContentItemVideoVideoUrlVideoUrl$Outbound = {
    url: string;
};
/** @internal */
export declare const ChatMessageContentItemVideoVideoUrlVideoUrl$outboundSchema: z.ZodType<ChatMessageContentItemVideoVideoUrlVideoUrl$Outbound, ChatMessageContentItemVideoVideoUrlVideoUrl>;
export declare function chatMessageContentItemVideoVideoUrlVideoUrlToJSON(chatMessageContentItemVideoVideoUrlVideoUrl: ChatMessageContentItemVideoVideoUrlVideoUrl): string;
export declare function chatMessageContentItemVideoVideoUrlVideoUrlFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemVideoVideoUrlVideoUrl, SDKValidationError>;
/** @internal */
export declare const ChatMessageContentItemVideoVideoURL$inboundSchema: z.ZodType<ChatMessageContentItemVideoVideoURL, unknown>;
/** @internal */
export type ChatMessageContentItemVideoVideoURL$Outbound = {
    type: "video_url";
    video_url: ChatMessageContentItemVideoVideoUrlVideoUrl$Outbound;
};
/** @internal */
export declare const ChatMessageContentItemVideoVideoURL$outboundSchema: z.ZodType<ChatMessageContentItemVideoVideoURL$Outbound, ChatMessageContentItemVideoVideoURL>;
export declare function chatMessageContentItemVideoVideoURLToJSON(chatMessageContentItemVideoVideoURL: ChatMessageContentItemVideoVideoURL): string;
export declare function chatMessageContentItemVideoVideoURLFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemVideoVideoURL, SDKValidationError>;
/** @internal */
export declare const ChatMessageContentItemVideoInputVideo$inboundSchema: z.ZodType<ChatMessageContentItemVideoInputVideo, unknown>;
/** @internal */
export type ChatMessageContentItemVideoInputVideo$Outbound = {
    type: "input_video";
    video_url: VideoURL$Outbound;
};
/** @internal */
export declare const ChatMessageContentItemVideoInputVideo$outboundSchema: z.ZodType<ChatMessageContentItemVideoInputVideo$Outbound, ChatMessageContentItemVideoInputVideo>;
export declare function chatMessageContentItemVideoInputVideoToJSON(chatMessageContentItemVideoInputVideo: ChatMessageContentItemVideoInputVideo): string;
export declare function chatMessageContentItemVideoInputVideoFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemVideoInputVideo, SDKValidationError>;
/** @internal */
export declare const ChatMessageContentItemVideo$inboundSchema: z.ZodType<ChatMessageContentItemVideo, unknown>;
/** @internal */
export type ChatMessageContentItemVideo$Outbound = ChatMessageContentItemVideoInputVideo$Outbound | ChatMessageContentItemVideoVideoURL$Outbound;
/** @internal */
export declare const ChatMessageContentItemVideo$outboundSchema: z.ZodType<ChatMessageContentItemVideo$Outbound, ChatMessageContentItemVideo>;
export declare function chatMessageContentItemVideoToJSON(chatMessageContentItemVideo: ChatMessageContentItemVideo): string;
export declare function chatMessageContentItemVideoFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemVideo, SDKValidationError>;
//# sourceMappingURL=chatmessagecontentitemvideo.d.ts.map