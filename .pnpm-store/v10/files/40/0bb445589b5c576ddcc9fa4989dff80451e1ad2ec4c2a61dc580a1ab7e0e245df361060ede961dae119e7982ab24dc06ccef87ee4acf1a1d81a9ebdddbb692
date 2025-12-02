import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { ChatGenerationTokenUsage } from "./chatgenerationtokenusage.js";
import { ChatStreamingChoice } from "./chatresponsechoice.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type ChatStreamingResponseChunkError = {
    message: string;
    code: number;
};
export type ChatStreamingResponseChunkData = {
    id: string;
    choices: Array<ChatStreamingChoice>;
    created: number;
    model: string;
    object: "chat.completion.chunk";
    systemFingerprint?: string | null | undefined;
    error?: ChatStreamingResponseChunkError | undefined;
    usage?: ChatGenerationTokenUsage | undefined;
};
export type ChatStreamingResponseChunk = {
    data: ChatStreamingResponseChunkData;
};
/** @internal */
export declare const ChatStreamingResponseChunkError$inboundSchema: z.ZodType<ChatStreamingResponseChunkError, unknown>;
export declare function chatStreamingResponseChunkErrorFromJSON(jsonString: string): SafeParseResult<ChatStreamingResponseChunkError, SDKValidationError>;
/** @internal */
export declare const ChatStreamingResponseChunkData$inboundSchema: z.ZodType<ChatStreamingResponseChunkData, unknown>;
export declare function chatStreamingResponseChunkDataFromJSON(jsonString: string): SafeParseResult<ChatStreamingResponseChunkData, SDKValidationError>;
/** @internal */
export declare const ChatStreamingResponseChunk$inboundSchema: z.ZodType<ChatStreamingResponseChunk, unknown>;
export declare function chatStreamingResponseChunkFromJSON(jsonString: string): SafeParseResult<ChatStreamingResponseChunk, SDKValidationError>;
//# sourceMappingURL=chatstreamingresponsechunk.d.ts.map