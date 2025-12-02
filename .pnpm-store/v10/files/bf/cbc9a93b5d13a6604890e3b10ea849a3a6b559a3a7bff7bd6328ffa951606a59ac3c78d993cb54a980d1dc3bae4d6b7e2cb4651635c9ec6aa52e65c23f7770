import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponsesFormatTextType: {
    readonly Text: "text";
};
export type ResponsesFormatTextType = ClosedEnum<typeof ResponsesFormatTextType>;
/**
 * Plain text response format
 */
export type ResponsesFormatText = {
    type: ResponsesFormatTextType;
};
/** @internal */
export declare const ResponsesFormatTextType$inboundSchema: z.ZodEnum<typeof ResponsesFormatTextType>;
/** @internal */
export declare const ResponsesFormatTextType$outboundSchema: z.ZodEnum<typeof ResponsesFormatTextType>;
/** @internal */
export declare const ResponsesFormatText$inboundSchema: z.ZodType<ResponsesFormatText, unknown>;
/** @internal */
export type ResponsesFormatText$Outbound = {
    type: string;
};
/** @internal */
export declare const ResponsesFormatText$outboundSchema: z.ZodType<ResponsesFormatText$Outbound, ResponsesFormatText>;
export declare function responsesFormatTextToJSON(responsesFormatText: ResponsesFormatText): string;
export declare function responsesFormatTextFromJSON(jsonString: string): SafeParseResult<ResponsesFormatText, SDKValidationError>;
//# sourceMappingURL=responsesformattext.d.ts.map