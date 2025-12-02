import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesImageGenCallPartialImageType: {
    readonly ResponseImageGenerationCallPartialImage: "response.image_generation_call.partial_image";
};
export type OpenResponsesImageGenCallPartialImageType = ClosedEnum<typeof OpenResponsesImageGenCallPartialImageType>;
/**
 * Image generation call with partial image
 */
export type OpenResponsesImageGenCallPartialImage = {
    type: OpenResponsesImageGenCallPartialImageType;
    itemId: string;
    outputIndex: number;
    sequenceNumber: number;
    partialImageB64: string;
    partialImageIndex: number;
};
/** @internal */
export declare const OpenResponsesImageGenCallPartialImageType$inboundSchema: z.ZodEnum<typeof OpenResponsesImageGenCallPartialImageType>;
/** @internal */
export declare const OpenResponsesImageGenCallPartialImage$inboundSchema: z.ZodType<OpenResponsesImageGenCallPartialImage, unknown>;
export declare function openResponsesImageGenCallPartialImageFromJSON(jsonString: string): SafeParseResult<OpenResponsesImageGenCallPartialImage, SDKValidationError>;
//# sourceMappingURL=openresponsesimagegencallpartialimage.d.ts.map