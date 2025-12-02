import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponsesFormatTextJSONSchemaConfigType: {
    readonly JsonSchema: "json_schema";
};
export type ResponsesFormatTextJSONSchemaConfigType = ClosedEnum<typeof ResponsesFormatTextJSONSchemaConfigType>;
/**
 * JSON schema constrained response format
 */
export type ResponsesFormatTextJSONSchemaConfig = {
    type: ResponsesFormatTextJSONSchemaConfigType;
    name: string;
    description?: string | undefined;
    strict?: boolean | null | undefined;
    schema: {
        [k: string]: any | null;
    };
};
/** @internal */
export declare const ResponsesFormatTextJSONSchemaConfigType$inboundSchema: z.ZodEnum<typeof ResponsesFormatTextJSONSchemaConfigType>;
/** @internal */
export declare const ResponsesFormatTextJSONSchemaConfigType$outboundSchema: z.ZodEnum<typeof ResponsesFormatTextJSONSchemaConfigType>;
/** @internal */
export declare const ResponsesFormatTextJSONSchemaConfig$inboundSchema: z.ZodType<ResponsesFormatTextJSONSchemaConfig, unknown>;
/** @internal */
export type ResponsesFormatTextJSONSchemaConfig$Outbound = {
    type: string;
    name: string;
    description?: string | undefined;
    strict?: boolean | null | undefined;
    schema: {
        [k: string]: any | null;
    };
};
/** @internal */
export declare const ResponsesFormatTextJSONSchemaConfig$outboundSchema: z.ZodType<ResponsesFormatTextJSONSchemaConfig$Outbound, ResponsesFormatTextJSONSchemaConfig>;
export declare function responsesFormatTextJSONSchemaConfigToJSON(responsesFormatTextJSONSchemaConfig: ResponsesFormatTextJSONSchemaConfig): string;
export declare function responsesFormatTextJSONSchemaConfigFromJSON(jsonString: string): SafeParseResult<ResponsesFormatTextJSONSchemaConfig, SDKValidationError>;
//# sourceMappingURL=responsesformattextjsonschemaconfig.d.ts.map