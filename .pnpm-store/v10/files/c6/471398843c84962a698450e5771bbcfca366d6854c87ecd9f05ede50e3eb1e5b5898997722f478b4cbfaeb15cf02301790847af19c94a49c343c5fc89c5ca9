import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OpenResponsesTopLogprobs } from "./openresponsestoplogprobs.js";
/**
 * Log probability information for a token
 */
export type OpenResponsesLogProbs = {
    logprob: number;
    token: string;
    topLogprobs?: Array<OpenResponsesTopLogprobs> | undefined;
};
/** @internal */
export declare const OpenResponsesLogProbs$inboundSchema: z.ZodType<OpenResponsesLogProbs, unknown>;
export declare function openResponsesLogProbsFromJSON(jsonString: string): SafeParseResult<OpenResponsesLogProbs, SDKValidationError>;
//# sourceMappingURL=openresponseslogprobs.d.ts.map