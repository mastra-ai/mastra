import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type InputTokensDetails = {
    cachedTokens: number;
};
export type OutputTokensDetails = {
    reasoningTokens: number;
};
export type CostDetails = {
    upstreamInferenceCost?: number | null | undefined;
    upstreamInferenceInputCost: number;
    upstreamInferenceOutputCost: number;
};
/**
 * Token usage information for the response
 */
export type OpenResponsesUsage = {
    inputTokens: number;
    inputTokensDetails: InputTokensDetails;
    outputTokens: number;
    outputTokensDetails: OutputTokensDetails;
    totalTokens: number;
    /**
     * Cost of the completion
     */
    cost?: number | null | undefined;
    /**
     * Whether a request was made using a Bring Your Own Key configuration
     */
    isByok?: boolean | undefined;
    costDetails?: CostDetails | undefined;
};
/** @internal */
export declare const InputTokensDetails$inboundSchema: z.ZodType<InputTokensDetails, unknown>;
export declare function inputTokensDetailsFromJSON(jsonString: string): SafeParseResult<InputTokensDetails, SDKValidationError>;
/** @internal */
export declare const OutputTokensDetails$inboundSchema: z.ZodType<OutputTokensDetails, unknown>;
export declare function outputTokensDetailsFromJSON(jsonString: string): SafeParseResult<OutputTokensDetails, SDKValidationError>;
/** @internal */
export declare const CostDetails$inboundSchema: z.ZodType<CostDetails, unknown>;
export declare function costDetailsFromJSON(jsonString: string): SafeParseResult<CostDetails, SDKValidationError>;
/** @internal */
export declare const OpenResponsesUsage$inboundSchema: z.ZodType<OpenResponsesUsage, unknown>;
export declare function openResponsesUsageFromJSON(jsonString: string): SafeParseResult<OpenResponsesUsage, SDKValidationError>;
//# sourceMappingURL=openresponsesusage.d.ts.map