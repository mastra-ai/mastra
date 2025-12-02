import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ImageGenerationStatus } from "./imagegenerationstatus.js";
export declare const OutputItemImageGenerationCallType: {
    readonly ImageGenerationCall: "image_generation_call";
};
export type OutputItemImageGenerationCallType = ClosedEnum<typeof OutputItemImageGenerationCallType>;
export type OutputItemImageGenerationCall = {
    type: OutputItemImageGenerationCallType;
    id: string;
    result?: string | null | undefined;
    status: ImageGenerationStatus;
};
/** @internal */
export declare const OutputItemImageGenerationCallType$inboundSchema: z.ZodEnum<typeof OutputItemImageGenerationCallType>;
/** @internal */
export declare const OutputItemImageGenerationCall$inboundSchema: z.ZodType<OutputItemImageGenerationCall, unknown>;
export declare function outputItemImageGenerationCallFromJSON(jsonString: string): SafeParseResult<OutputItemImageGenerationCall, SDKValidationError>;
//# sourceMappingURL=outputitemimagegenerationcall.d.ts.map