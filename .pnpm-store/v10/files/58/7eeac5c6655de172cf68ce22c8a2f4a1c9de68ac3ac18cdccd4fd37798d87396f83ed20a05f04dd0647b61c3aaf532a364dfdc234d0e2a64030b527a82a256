import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenAIResponsesRefusalContentType: {
    readonly Refusal: "refusal";
};
export type OpenAIResponsesRefusalContentType = ClosedEnum<typeof OpenAIResponsesRefusalContentType>;
export type OpenAIResponsesRefusalContent = {
    type: OpenAIResponsesRefusalContentType;
    refusal: string;
};
/** @internal */
export declare const OpenAIResponsesRefusalContentType$inboundSchema: z.ZodEnum<typeof OpenAIResponsesRefusalContentType>;
/** @internal */
export declare const OpenAIResponsesRefusalContentType$outboundSchema: z.ZodEnum<typeof OpenAIResponsesRefusalContentType>;
/** @internal */
export declare const OpenAIResponsesRefusalContent$inboundSchema: z.ZodType<OpenAIResponsesRefusalContent, unknown>;
/** @internal */
export type OpenAIResponsesRefusalContent$Outbound = {
    type: string;
    refusal: string;
};
/** @internal */
export declare const OpenAIResponsesRefusalContent$outboundSchema: z.ZodType<OpenAIResponsesRefusalContent$Outbound, OpenAIResponsesRefusalContent>;
export declare function openAIResponsesRefusalContentToJSON(openAIResponsesRefusalContent: OpenAIResponsesRefusalContent): string;
export declare function openAIResponsesRefusalContentFromJSON(jsonString: string): SafeParseResult<OpenAIResponsesRefusalContent, SDKValidationError>;
//# sourceMappingURL=openairesponsesrefusalcontent.d.ts.map