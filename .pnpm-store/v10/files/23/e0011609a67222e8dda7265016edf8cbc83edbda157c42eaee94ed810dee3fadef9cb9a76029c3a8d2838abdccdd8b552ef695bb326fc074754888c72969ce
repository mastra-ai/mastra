import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { CompletionChoice } from "./completionchoice.js";
import { CompletionUsage } from "./completionusage.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type CompletionResponse = {
    id: string;
    object: "text_completion";
    created: number;
    model: string;
    systemFingerprint?: string | undefined;
    choices: Array<CompletionChoice>;
    usage?: CompletionUsage | undefined;
};
/** @internal */
export declare const CompletionResponse$inboundSchema: z.ZodType<CompletionResponse, unknown>;
export declare function completionResponseFromJSON(jsonString: string): SafeParseResult<CompletionResponse, SDKValidationError>;
//# sourceMappingURL=completionresponse.d.ts.map