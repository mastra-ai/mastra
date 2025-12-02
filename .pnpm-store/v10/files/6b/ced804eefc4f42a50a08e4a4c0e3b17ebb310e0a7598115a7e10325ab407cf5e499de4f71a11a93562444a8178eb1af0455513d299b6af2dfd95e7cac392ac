import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type CompletionUsage = {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
};
/** @internal */
export declare const CompletionUsage$inboundSchema: z.ZodType<CompletionUsage, unknown>;
export declare function completionUsageFromJSON(jsonString: string): SafeParseResult<CompletionUsage, SDKValidationError>;
//# sourceMappingURL=completionusage.d.ts.map