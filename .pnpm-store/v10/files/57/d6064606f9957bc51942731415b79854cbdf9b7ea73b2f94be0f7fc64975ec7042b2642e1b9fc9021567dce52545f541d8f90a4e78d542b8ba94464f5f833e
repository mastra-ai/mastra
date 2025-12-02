import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ChatMessageContentItemImageDetail: {
    readonly Auto: "auto";
    readonly Low: "low";
    readonly High: "high";
};
export type ChatMessageContentItemImageDetail = OpenEnum<typeof ChatMessageContentItemImageDetail>;
export type ImageUrl = {
    url: string;
    detail?: ChatMessageContentItemImageDetail | undefined;
};
export type ChatMessageContentItemImage = {
    type: "image_url";
    imageUrl: ImageUrl;
};
/** @internal */
export declare const ChatMessageContentItemImageDetail$inboundSchema: z.ZodType<ChatMessageContentItemImageDetail, unknown>;
/** @internal */
export declare const ChatMessageContentItemImageDetail$outboundSchema: z.ZodType<string, ChatMessageContentItemImageDetail>;
/** @internal */
export declare const ImageUrl$inboundSchema: z.ZodType<ImageUrl, unknown>;
/** @internal */
export type ImageUrl$Outbound = {
    url: string;
    detail?: string | undefined;
};
/** @internal */
export declare const ImageUrl$outboundSchema: z.ZodType<ImageUrl$Outbound, ImageUrl>;
export declare function imageUrlToJSON(imageUrl: ImageUrl): string;
export declare function imageUrlFromJSON(jsonString: string): SafeParseResult<ImageUrl, SDKValidationError>;
/** @internal */
export declare const ChatMessageContentItemImage$inboundSchema: z.ZodType<ChatMessageContentItemImage, unknown>;
/** @internal */
export type ChatMessageContentItemImage$Outbound = {
    type: "image_url";
    image_url: ImageUrl$Outbound;
};
/** @internal */
export declare const ChatMessageContentItemImage$outboundSchema: z.ZodType<ChatMessageContentItemImage$Outbound, ChatMessageContentItemImage>;
export declare function chatMessageContentItemImageToJSON(chatMessageContentItemImage: ChatMessageContentItemImage): string;
export declare function chatMessageContentItemImageFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemImage, SDKValidationError>;
//# sourceMappingURL=chatmessagecontentitemimage.d.ts.map