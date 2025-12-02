import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { CompletionLogprobs } from "./completionlogprobs.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const CompletionFinishReason: {
    readonly Stop: "stop";
    readonly Length: "length";
    readonly ContentFilter: "content_filter";
};
export type CompletionFinishReason = OpenEnum<typeof CompletionFinishReason>;
export type CompletionChoice = {
    text: string;
    index: number;
    logprobs: CompletionLogprobs | null;
    finishReason: CompletionFinishReason | null;
};
/** @internal */
export declare const CompletionFinishReason$inboundSchema: z.ZodType<CompletionFinishReason, unknown>;
/** @internal */
export declare const CompletionChoice$inboundSchema: z.ZodType<CompletionChoice, unknown>;
export declare function completionChoiceFromJSON(jsonString: string): SafeParseResult<CompletionChoice, SDKValidationError>;
//# sourceMappingURL=completionchoice.d.ts.map