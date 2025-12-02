import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OpenAIResponsesReasoningEffort } from "./openairesponsesreasoningeffort.js";
import { ReasoningSummaryVerbosity } from "./reasoningsummaryverbosity.js";
export type OpenAIResponsesReasoningConfig = {
    effort?: OpenAIResponsesReasoningEffort | null | undefined;
    summary?: ReasoningSummaryVerbosity | undefined;
};
/** @internal */
export declare const OpenAIResponsesReasoningConfig$inboundSchema: z.ZodType<OpenAIResponsesReasoningConfig, unknown>;
export declare function openAIResponsesReasoningConfigFromJSON(jsonString: string): SafeParseResult<OpenAIResponsesReasoningConfig, SDKValidationError>;
//# sourceMappingURL=openairesponsesreasoningconfig.d.ts.map