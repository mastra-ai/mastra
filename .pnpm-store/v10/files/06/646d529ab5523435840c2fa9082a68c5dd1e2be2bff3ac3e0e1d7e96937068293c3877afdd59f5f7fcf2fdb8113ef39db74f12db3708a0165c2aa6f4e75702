import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponseInputTextType: {
    readonly InputText: "input_text";
};
export type ResponseInputTextType = ClosedEnum<typeof ResponseInputTextType>;
/**
 * Text input content item
 */
export type ResponseInputText = {
    type: ResponseInputTextType;
    text: string;
};
/** @internal */
export declare const ResponseInputTextType$inboundSchema: z.ZodEnum<typeof ResponseInputTextType>;
/** @internal */
export declare const ResponseInputTextType$outboundSchema: z.ZodEnum<typeof ResponseInputTextType>;
/** @internal */
export declare const ResponseInputText$inboundSchema: z.ZodType<ResponseInputText, unknown>;
/** @internal */
export type ResponseInputText$Outbound = {
    type: string;
    text: string;
};
/** @internal */
export declare const ResponseInputText$outboundSchema: z.ZodType<ResponseInputText$Outbound, ResponseInputText>;
export declare function responseInputTextToJSON(responseInputText: ResponseInputText): string;
export declare function responseInputTextFromJSON(jsonString: string): SafeParseResult<ResponseInputText, SDKValidationError>;
//# sourceMappingURL=responseinputtext.d.ts.map