import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OpenAIResponsesAnnotation, OpenAIResponsesAnnotation$Outbound } from "./openairesponsesannotation.js";
export declare const ResponseOutputTextType: {
    readonly OutputText: "output_text";
};
export type ResponseOutputTextType = ClosedEnum<typeof ResponseOutputTextType>;
export type ResponseOutputText = {
    type: ResponseOutputTextType;
    text: string;
    annotations?: Array<OpenAIResponsesAnnotation> | undefined;
};
/** @internal */
export declare const ResponseOutputTextType$inboundSchema: z.ZodEnum<typeof ResponseOutputTextType>;
/** @internal */
export declare const ResponseOutputTextType$outboundSchema: z.ZodEnum<typeof ResponseOutputTextType>;
/** @internal */
export declare const ResponseOutputText$inboundSchema: z.ZodType<ResponseOutputText, unknown>;
/** @internal */
export type ResponseOutputText$Outbound = {
    type: string;
    text: string;
    annotations?: Array<OpenAIResponsesAnnotation$Outbound> | undefined;
};
/** @internal */
export declare const ResponseOutputText$outboundSchema: z.ZodType<ResponseOutputText$Outbound, ResponseOutputText>;
export declare function responseOutputTextToJSON(responseOutputText: ResponseOutputText): string;
export declare function responseOutputTextFromJSON(jsonString: string): SafeParseResult<ResponseOutputText, SDKValidationError>;
//# sourceMappingURL=responseoutputtext.d.ts.map