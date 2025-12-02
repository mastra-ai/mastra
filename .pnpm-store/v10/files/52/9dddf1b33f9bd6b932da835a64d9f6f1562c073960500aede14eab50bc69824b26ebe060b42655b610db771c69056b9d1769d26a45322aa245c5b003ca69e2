import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type CompletionLogprobs = {
    tokens: Array<string>;
    tokenLogprobs: Array<number>;
    topLogprobs: Array<{
        [k: string]: number;
    }> | null;
    textOffset: Array<number>;
};
/** @internal */
export declare const CompletionLogprobs$inboundSchema: z.ZodType<CompletionLogprobs, unknown>;
export declare function completionLogprobsFromJSON(jsonString: string): SafeParseResult<CompletionLogprobs, SDKValidationError>;
//# sourceMappingURL=completionlogprobs.d.ts.map