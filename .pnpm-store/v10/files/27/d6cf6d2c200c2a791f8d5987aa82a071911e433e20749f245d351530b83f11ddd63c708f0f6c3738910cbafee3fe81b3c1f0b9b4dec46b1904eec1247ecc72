import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesImageGenCallGeneratingType: {
    readonly ResponseImageGenerationCallGenerating: "response.image_generation_call.generating";
};
export type OpenResponsesImageGenCallGeneratingType = ClosedEnum<typeof OpenResponsesImageGenCallGeneratingType>;
/**
 * Image generation call is generating
 */
export type OpenResponsesImageGenCallGenerating = {
    type: OpenResponsesImageGenCallGeneratingType;
    itemId: string;
    outputIndex: number;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesImageGenCallGeneratingType$inboundSchema: z.ZodEnum<typeof OpenResponsesImageGenCallGeneratingType>;
/** @internal */
export declare const OpenResponsesImageGenCallGenerating$inboundSchema: z.ZodType<OpenResponsesImageGenCallGenerating, unknown>;
export declare function openResponsesImageGenCallGeneratingFromJSON(jsonString: string): SafeParseResult<OpenResponsesImageGenCallGenerating, SDKValidationError>;
//# sourceMappingURL=openresponsesimagegencallgenerating.d.ts.map