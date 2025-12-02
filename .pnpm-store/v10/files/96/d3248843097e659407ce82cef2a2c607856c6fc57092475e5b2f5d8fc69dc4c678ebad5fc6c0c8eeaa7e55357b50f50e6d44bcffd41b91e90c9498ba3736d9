import * as z from "zod/v4";
import { ClosedEnum, OpenEnum } from "../types/enums.js";
import { ReasoningSummaryText, ReasoningSummaryText$Outbound } from "./reasoningsummarytext.js";
import { ReasoningTextContent, ReasoningTextContent$Outbound } from "./reasoningtextcontent.js";
export declare const OpenResponsesReasoningType: {
    readonly Reasoning: "reasoning";
};
export type OpenResponsesReasoningType = ClosedEnum<typeof OpenResponsesReasoningType>;
export declare const OpenResponsesReasoningStatusInProgress: {
    readonly InProgress: "in_progress";
};
export type OpenResponsesReasoningStatusInProgress = ClosedEnum<typeof OpenResponsesReasoningStatusInProgress>;
export declare const OpenResponsesReasoningStatusIncomplete: {
    readonly Incomplete: "incomplete";
};
export type OpenResponsesReasoningStatusIncomplete = ClosedEnum<typeof OpenResponsesReasoningStatusIncomplete>;
export declare const OpenResponsesReasoningStatusCompleted: {
    readonly Completed: "completed";
};
export type OpenResponsesReasoningStatusCompleted = ClosedEnum<typeof OpenResponsesReasoningStatusCompleted>;
export type OpenResponsesReasoningStatusUnion = OpenResponsesReasoningStatusCompleted | OpenResponsesReasoningStatusIncomplete | OpenResponsesReasoningStatusInProgress;
export declare const OpenResponsesReasoningFormat: {
    readonly Unknown: "unknown";
    readonly OpenaiResponsesV1: "openai-responses-v1";
    readonly XaiResponsesV1: "xai-responses-v1";
    readonly AnthropicClaudeV1: "anthropic-claude-v1";
    readonly GoogleGeminiV1: "google-gemini-v1";
};
export type OpenResponsesReasoningFormat = OpenEnum<typeof OpenResponsesReasoningFormat>;
/**
 * Reasoning output item with signature and format extensions
 */
export type OpenResponsesReasoning = {
    type: OpenResponsesReasoningType;
    id: string;
    content?: Array<ReasoningTextContent> | undefined;
    summary: Array<ReasoningSummaryText>;
    encryptedContent?: string | null | undefined;
    status?: OpenResponsesReasoningStatusCompleted | OpenResponsesReasoningStatusIncomplete | OpenResponsesReasoningStatusInProgress | undefined;
    signature?: string | null | undefined;
    format?: OpenResponsesReasoningFormat | null | undefined;
};
/** @internal */
export declare const OpenResponsesReasoningType$outboundSchema: z.ZodEnum<typeof OpenResponsesReasoningType>;
/** @internal */
export declare const OpenResponsesReasoningStatusInProgress$outboundSchema: z.ZodEnum<typeof OpenResponsesReasoningStatusInProgress>;
/** @internal */
export declare const OpenResponsesReasoningStatusIncomplete$outboundSchema: z.ZodEnum<typeof OpenResponsesReasoningStatusIncomplete>;
/** @internal */
export declare const OpenResponsesReasoningStatusCompleted$outboundSchema: z.ZodEnum<typeof OpenResponsesReasoningStatusCompleted>;
/** @internal */
export type OpenResponsesReasoningStatusUnion$Outbound = string | string | string;
/** @internal */
export declare const OpenResponsesReasoningStatusUnion$outboundSchema: z.ZodType<OpenResponsesReasoningStatusUnion$Outbound, OpenResponsesReasoningStatusUnion>;
export declare function openResponsesReasoningStatusUnionToJSON(openResponsesReasoningStatusUnion: OpenResponsesReasoningStatusUnion): string;
/** @internal */
export declare const OpenResponsesReasoningFormat$outboundSchema: z.ZodType<string, OpenResponsesReasoningFormat>;
/** @internal */
export type OpenResponsesReasoning$Outbound = {
    type: string;
    id: string;
    content?: Array<ReasoningTextContent$Outbound> | undefined;
    summary: Array<ReasoningSummaryText$Outbound>;
    encrypted_content?: string | null | undefined;
    status?: string | string | string | undefined;
    signature?: string | null | undefined;
    format?: string | null | undefined;
};
/** @internal */
export declare const OpenResponsesReasoning$outboundSchema: z.ZodType<OpenResponsesReasoning$Outbound, OpenResponsesReasoning>;
export declare function openResponsesReasoningToJSON(openResponsesReasoning: OpenResponsesReasoning): string;
//# sourceMappingURL=openresponsesreasoning.d.ts.map