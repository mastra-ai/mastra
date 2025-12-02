import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponsesFormatJSONObject, ResponsesFormatJSONObject$Outbound } from "./responsesformatjsonobject.js";
import { ResponsesFormatText, ResponsesFormatText$Outbound } from "./responsesformattext.js";
import { ResponsesFormatTextJSONSchemaConfig, ResponsesFormatTextJSONSchemaConfig$Outbound } from "./responsesformattextjsonschemaconfig.js";
/**
 * Text response format configuration
 */
export type ResponseFormatTextConfig = ResponsesFormatTextJSONSchemaConfig | ResponsesFormatText | ResponsesFormatJSONObject;
/** @internal */
export declare const ResponseFormatTextConfig$inboundSchema: z.ZodType<ResponseFormatTextConfig, unknown>;
/** @internal */
export type ResponseFormatTextConfig$Outbound = ResponsesFormatTextJSONSchemaConfig$Outbound | ResponsesFormatText$Outbound | ResponsesFormatJSONObject$Outbound;
/** @internal */
export declare const ResponseFormatTextConfig$outboundSchema: z.ZodType<ResponseFormatTextConfig$Outbound, ResponseFormatTextConfig>;
export declare function responseFormatTextConfigToJSON(responseFormatTextConfig: ResponseFormatTextConfig): string;
export declare function responseFormatTextConfigFromJSON(jsonString: string): SafeParseResult<ResponseFormatTextConfig, SDKValidationError>;
//# sourceMappingURL=responseformattextconfig.d.ts.map