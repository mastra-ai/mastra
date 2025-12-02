import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesImageGenCallCompletedType: {
    readonly ResponseImageGenerationCallCompleted: "response.image_generation_call.completed";
};
export type OpenResponsesImageGenCallCompletedType = ClosedEnum<typeof OpenResponsesImageGenCallCompletedType>;
/**
 * Image generation call completed
 */
export type OpenResponsesImageGenCallCompleted = {
    type: OpenResponsesImageGenCallCompletedType;
    itemId: string;
    outputIndex: number;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesImageGenCallCompletedType$inboundSchema: z.ZodEnum<typeof OpenResponsesImageGenCallCompletedType>;
/** @internal */
export declare const OpenResponsesImageGenCallCompleted$inboundSchema: z.ZodType<OpenResponsesImageGenCallCompleted, unknown>;
export declare function openResponsesImageGenCallCompletedFromJSON(jsonString: string): SafeParseResult<OpenResponsesImageGenCallCompleted, SDKValidationError>;
//# sourceMappingURL=openresponsesimagegencallcompleted.d.ts.map