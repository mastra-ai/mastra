import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesImageGenCallInProgressType: {
    readonly ResponseImageGenerationCallInProgress: "response.image_generation_call.in_progress";
};
export type OpenResponsesImageGenCallInProgressType = ClosedEnum<typeof OpenResponsesImageGenCallInProgressType>;
/**
 * Image generation call in progress
 */
export type OpenResponsesImageGenCallInProgress = {
    type: OpenResponsesImageGenCallInProgressType;
    itemId: string;
    outputIndex: number;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesImageGenCallInProgressType$inboundSchema: z.ZodEnum<typeof OpenResponsesImageGenCallInProgressType>;
/** @internal */
export declare const OpenResponsesImageGenCallInProgress$inboundSchema: z.ZodType<OpenResponsesImageGenCallInProgress, unknown>;
export declare function openResponsesImageGenCallInProgressFromJSON(jsonString: string): SafeParseResult<OpenResponsesImageGenCallInProgress, SDKValidationError>;
//# sourceMappingURL=openresponsesimagegencallinprogress.d.ts.map