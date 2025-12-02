import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponsesFormatJSONObjectType: {
    readonly JsonObject: "json_object";
};
export type ResponsesFormatJSONObjectType = ClosedEnum<typeof ResponsesFormatJSONObjectType>;
/**
 * JSON object response format
 */
export type ResponsesFormatJSONObject = {
    type: ResponsesFormatJSONObjectType;
};
/** @internal */
export declare const ResponsesFormatJSONObjectType$inboundSchema: z.ZodEnum<typeof ResponsesFormatJSONObjectType>;
/** @internal */
export declare const ResponsesFormatJSONObjectType$outboundSchema: z.ZodEnum<typeof ResponsesFormatJSONObjectType>;
/** @internal */
export declare const ResponsesFormatJSONObject$inboundSchema: z.ZodType<ResponsesFormatJSONObject, unknown>;
/** @internal */
export type ResponsesFormatJSONObject$Outbound = {
    type: string;
};
/** @internal */
export declare const ResponsesFormatJSONObject$outboundSchema: z.ZodType<ResponsesFormatJSONObject$Outbound, ResponsesFormatJSONObject>;
export declare function responsesFormatJSONObjectToJSON(responsesFormatJSONObject: ResponsesFormatJSONObject): string;
export declare function responsesFormatJSONObjectFromJSON(jsonString: string): SafeParseResult<ResponsesFormatJSONObject, SDKValidationError>;
//# sourceMappingURL=responsesformatjsonobject.d.ts.map