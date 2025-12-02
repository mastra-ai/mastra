import * as z from "zod/v4";
import { OpenAIResponsesReasoningEffort } from "./openairesponsesreasoningeffort.js";
import { ReasoningSummaryVerbosity } from "./reasoningsummaryverbosity.js";
/**
 * Configuration for reasoning mode in the response
 */
export type OpenResponsesReasoningConfig = {
    effort?: OpenAIResponsesReasoningEffort | null | undefined;
    summary?: ReasoningSummaryVerbosity | undefined;
    maxTokens?: number | null | undefined;
    enabled?: boolean | null | undefined;
};
/** @internal */
export type OpenResponsesReasoningConfig$Outbound = {
    effort?: string | null | undefined;
    summary?: string | undefined;
    max_tokens?: number | null | undefined;
    enabled?: boolean | null | undefined;
};
/** @internal */
export declare const OpenResponsesReasoningConfig$outboundSchema: z.ZodType<OpenResponsesReasoningConfig$Outbound, OpenResponsesReasoningConfig>;
export declare function openResponsesReasoningConfigToJSON(openResponsesReasoningConfig: OpenResponsesReasoningConfig): string;
//# sourceMappingURL=openresponsesreasoningconfig.d.ts.map