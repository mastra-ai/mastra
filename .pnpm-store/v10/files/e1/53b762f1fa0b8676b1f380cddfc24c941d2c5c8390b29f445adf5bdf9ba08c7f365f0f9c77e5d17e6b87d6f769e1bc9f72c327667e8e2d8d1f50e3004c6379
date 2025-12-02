import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type CompletionTokensDetails = {
    reasoningTokens?: number | null | undefined;
    audioTokens?: number | null | undefined;
    acceptedPredictionTokens?: number | null | undefined;
    rejectedPredictionTokens?: number | null | undefined;
};
export type PromptTokensDetails = {
    cachedTokens?: number | undefined;
    audioTokens?: number | undefined;
    videoTokens?: number | undefined;
};
export type ChatGenerationTokenUsage = {
    completionTokens: number;
    promptTokens: number;
    totalTokens: number;
    completionTokensDetails?: CompletionTokensDetails | null | undefined;
    promptTokensDetails?: PromptTokensDetails | null | undefined;
};
/** @internal */
export declare const CompletionTokensDetails$inboundSchema: z.ZodType<CompletionTokensDetails, unknown>;
export declare function completionTokensDetailsFromJSON(jsonString: string): SafeParseResult<CompletionTokensDetails, SDKValidationError>;
/** @internal */
export declare const PromptTokensDetails$inboundSchema: z.ZodType<PromptTokensDetails, unknown>;
export declare function promptTokensDetailsFromJSON(jsonString: string): SafeParseResult<PromptTokensDetails, SDKValidationError>;
/** @internal */
export declare const ChatGenerationTokenUsage$inboundSchema: z.ZodType<ChatGenerationTokenUsage, unknown>;
export declare function chatGenerationTokenUsageFromJSON(jsonString: string): SafeParseResult<ChatGenerationTokenUsage, SDKValidationError>;
//# sourceMappingURL=chatgenerationtokenusage.d.ts.map