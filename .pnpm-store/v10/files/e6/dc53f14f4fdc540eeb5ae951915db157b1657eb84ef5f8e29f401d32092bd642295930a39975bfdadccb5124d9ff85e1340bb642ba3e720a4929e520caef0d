import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ChatMessageContentItemAudioFormat: {
    readonly Wav: "wav";
    readonly Mp3: "mp3";
    readonly Flac: "flac";
    readonly M4a: "m4a";
    readonly Ogg: "ogg";
    readonly Pcm16: "pcm16";
    readonly Pcm24: "pcm24";
};
export type ChatMessageContentItemAudioFormat = OpenEnum<typeof ChatMessageContentItemAudioFormat>;
export type ChatMessageContentItemAudioInputAudio = {
    data: string;
    format: ChatMessageContentItemAudioFormat;
};
export type ChatMessageContentItemAudio = {
    type: "input_audio";
    inputAudio: ChatMessageContentItemAudioInputAudio;
};
/** @internal */
export declare const ChatMessageContentItemAudioFormat$inboundSchema: z.ZodType<ChatMessageContentItemAudioFormat, unknown>;
/** @internal */
export declare const ChatMessageContentItemAudioFormat$outboundSchema: z.ZodType<string, ChatMessageContentItemAudioFormat>;
/** @internal */
export declare const ChatMessageContentItemAudioInputAudio$inboundSchema: z.ZodType<ChatMessageContentItemAudioInputAudio, unknown>;
/** @internal */
export type ChatMessageContentItemAudioInputAudio$Outbound = {
    data: string;
    format: string;
};
/** @internal */
export declare const ChatMessageContentItemAudioInputAudio$outboundSchema: z.ZodType<ChatMessageContentItemAudioInputAudio$Outbound, ChatMessageContentItemAudioInputAudio>;
export declare function chatMessageContentItemAudioInputAudioToJSON(chatMessageContentItemAudioInputAudio: ChatMessageContentItemAudioInputAudio): string;
export declare function chatMessageContentItemAudioInputAudioFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemAudioInputAudio, SDKValidationError>;
/** @internal */
export declare const ChatMessageContentItemAudio$inboundSchema: z.ZodType<ChatMessageContentItemAudio, unknown>;
/** @internal */
export type ChatMessageContentItemAudio$Outbound = {
    type: "input_audio";
    input_audio: ChatMessageContentItemAudioInputAudio$Outbound;
};
/** @internal */
export declare const ChatMessageContentItemAudio$outboundSchema: z.ZodType<ChatMessageContentItemAudio$Outbound, ChatMessageContentItemAudio>;
export declare function chatMessageContentItemAudioToJSON(chatMessageContentItemAudio: ChatMessageContentItemAudio): string;
export declare function chatMessageContentItemAudioFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemAudio, SDKValidationError>;
//# sourceMappingURL=chatmessagecontentitemaudio.d.ts.map