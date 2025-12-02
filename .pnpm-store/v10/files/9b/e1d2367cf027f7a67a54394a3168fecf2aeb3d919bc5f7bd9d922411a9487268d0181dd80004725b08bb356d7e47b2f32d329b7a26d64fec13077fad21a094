import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
/**
 * Per-request token limits
 */
export type PerRequestLimits = {
    /**
     * Maximum prompt tokens per request
     */
    promptTokens: number;
    /**
     * Maximum completion tokens per request
     */
    completionTokens: number;
};
/** @internal */
export declare const PerRequestLimits$inboundSchema: z.ZodType<PerRequestLimits, unknown>;
export declare function perRequestLimitsFromJSON(jsonString: string): SafeParseResult<PerRequestLimits, SDKValidationError>;
//# sourceMappingURL=perrequestlimits.d.ts.map