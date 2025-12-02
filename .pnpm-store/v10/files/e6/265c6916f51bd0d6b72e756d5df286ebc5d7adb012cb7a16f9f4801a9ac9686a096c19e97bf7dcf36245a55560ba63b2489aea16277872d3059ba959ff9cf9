import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ImageGenerationStatus } from "./imagegenerationstatus.js";
export declare const ResponsesImageGenerationCallType: {
    readonly ImageGenerationCall: "image_generation_call";
};
export type ResponsesImageGenerationCallType = ClosedEnum<typeof ResponsesImageGenerationCallType>;
export type ResponsesImageGenerationCall = {
    type: ResponsesImageGenerationCallType;
    id: string;
    result?: string | null | undefined;
    status: ImageGenerationStatus;
};
/** @internal */
export declare const ResponsesImageGenerationCallType$inboundSchema: z.ZodEnum<typeof ResponsesImageGenerationCallType>;
/** @internal */
export declare const ResponsesImageGenerationCallType$outboundSchema: z.ZodEnum<typeof ResponsesImageGenerationCallType>;
/** @internal */
export declare const ResponsesImageGenerationCall$inboundSchema: z.ZodType<ResponsesImageGenerationCall, unknown>;
/** @internal */
export type ResponsesImageGenerationCall$Outbound = {
    type: string;
    id: string;
    result: string | null;
    status: string;
};
/** @internal */
export declare const ResponsesImageGenerationCall$outboundSchema: z.ZodType<ResponsesImageGenerationCall$Outbound, ResponsesImageGenerationCall>;
export declare function responsesImageGenerationCallToJSON(responsesImageGenerationCall: ResponsesImageGenerationCall): string;
export declare function responsesImageGenerationCallFromJSON(jsonString: string): SafeParseResult<ResponsesImageGenerationCall, SDKValidationError>;
//# sourceMappingURL=responsesimagegenerationcall.d.ts.map