import * as z from "zod/v4";
import { ClosedEnum, OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponseInputAudioType: {
    readonly InputAudio: "input_audio";
};
export type ResponseInputAudioType = ClosedEnum<typeof ResponseInputAudioType>;
export declare const ResponseInputAudioFormat: {
    readonly Mp3: "mp3";
    readonly Wav: "wav";
};
export type ResponseInputAudioFormat = OpenEnum<typeof ResponseInputAudioFormat>;
export type ResponseInputAudioInputAudio = {
    data: string;
    format: ResponseInputAudioFormat;
};
/**
 * Audio input content item
 */
export type ResponseInputAudio = {
    type: ResponseInputAudioType;
    inputAudio: ResponseInputAudioInputAudio;
};
/** @internal */
export declare const ResponseInputAudioType$inboundSchema: z.ZodEnum<typeof ResponseInputAudioType>;
/** @internal */
export declare const ResponseInputAudioType$outboundSchema: z.ZodEnum<typeof ResponseInputAudioType>;
/** @internal */
export declare const ResponseInputAudioFormat$inboundSchema: z.ZodType<ResponseInputAudioFormat, unknown>;
/** @internal */
export declare const ResponseInputAudioFormat$outboundSchema: z.ZodType<string, ResponseInputAudioFormat>;
/** @internal */
export declare const ResponseInputAudioInputAudio$inboundSchema: z.ZodType<ResponseInputAudioInputAudio, unknown>;
/** @internal */
export type ResponseInputAudioInputAudio$Outbound = {
    data: string;
    format: string;
};
/** @internal */
export declare const ResponseInputAudioInputAudio$outboundSchema: z.ZodType<ResponseInputAudioInputAudio$Outbound, ResponseInputAudioInputAudio>;
export declare function responseInputAudioInputAudioToJSON(responseInputAudioInputAudio: ResponseInputAudioInputAudio): string;
export declare function responseInputAudioInputAudioFromJSON(jsonString: string): SafeParseResult<ResponseInputAudioInputAudio, SDKValidationError>;
/** @internal */
export declare const ResponseInputAudio$inboundSchema: z.ZodType<ResponseInputAudio, unknown>;
/** @internal */
export type ResponseInputAudio$Outbound = {
    type: string;
    input_audio: ResponseInputAudioInputAudio$Outbound;
};
/** @internal */
export declare const ResponseInputAudio$outboundSchema: z.ZodType<ResponseInputAudio$Outbound, ResponseInputAudio>;
export declare function responseInputAudioToJSON(responseInputAudio: ResponseInputAudio): string;
export declare function responseInputAudioFromJSON(jsonString: string): SafeParseResult<ResponseInputAudio, SDKValidationError>;
//# sourceMappingURL=responseinputaudio.d.ts.map