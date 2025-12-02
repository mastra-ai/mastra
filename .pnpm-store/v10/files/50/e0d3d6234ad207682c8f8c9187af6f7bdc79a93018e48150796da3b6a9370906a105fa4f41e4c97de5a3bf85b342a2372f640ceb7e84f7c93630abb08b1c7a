import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ReasoningSummaryText, ReasoningSummaryText$Outbound } from "./reasoningsummarytext.js";
import { ReasoningTextContent, ReasoningTextContent$Outbound } from "./reasoningtextcontent.js";
export declare const ResponsesOutputItemReasoningType: {
    readonly Reasoning: "reasoning";
};
export type ResponsesOutputItemReasoningType = ClosedEnum<typeof ResponsesOutputItemReasoningType>;
export declare const ResponsesOutputItemReasoningStatusInProgress: {
    readonly InProgress: "in_progress";
};
export type ResponsesOutputItemReasoningStatusInProgress = ClosedEnum<typeof ResponsesOutputItemReasoningStatusInProgress>;
export declare const ResponsesOutputItemReasoningStatusIncomplete: {
    readonly Incomplete: "incomplete";
};
export type ResponsesOutputItemReasoningStatusIncomplete = ClosedEnum<typeof ResponsesOutputItemReasoningStatusIncomplete>;
export declare const ResponsesOutputItemReasoningStatusCompleted: {
    readonly Completed: "completed";
};
export type ResponsesOutputItemReasoningStatusCompleted = ClosedEnum<typeof ResponsesOutputItemReasoningStatusCompleted>;
export type ResponsesOutputItemReasoningStatusUnion = ResponsesOutputItemReasoningStatusCompleted | ResponsesOutputItemReasoningStatusIncomplete | ResponsesOutputItemReasoningStatusInProgress;
/**
 * An output item containing reasoning
 */
export type ResponsesOutputItemReasoning = {
    type: ResponsesOutputItemReasoningType;
    id: string;
    content?: Array<ReasoningTextContent> | undefined;
    summary: Array<ReasoningSummaryText>;
    encryptedContent?: string | null | undefined;
    status?: ResponsesOutputItemReasoningStatusCompleted | ResponsesOutputItemReasoningStatusIncomplete | ResponsesOutputItemReasoningStatusInProgress | undefined;
};
/** @internal */
export declare const ResponsesOutputItemReasoningType$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningType>;
/** @internal */
export declare const ResponsesOutputItemReasoningType$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningType>;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusInProgress$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningStatusInProgress>;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusInProgress$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningStatusInProgress>;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusIncomplete$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningStatusIncomplete>;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusIncomplete$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningStatusIncomplete>;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusCompleted$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningStatusCompleted>;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusCompleted$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemReasoningStatusCompleted>;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusUnion$inboundSchema: z.ZodType<ResponsesOutputItemReasoningStatusUnion, unknown>;
/** @internal */
export type ResponsesOutputItemReasoningStatusUnion$Outbound = string | string | string;
/** @internal */
export declare const ResponsesOutputItemReasoningStatusUnion$outboundSchema: z.ZodType<ResponsesOutputItemReasoningStatusUnion$Outbound, ResponsesOutputItemReasoningStatusUnion>;
export declare function responsesOutputItemReasoningStatusUnionToJSON(responsesOutputItemReasoningStatusUnion: ResponsesOutputItemReasoningStatusUnion): string;
export declare function responsesOutputItemReasoningStatusUnionFromJSON(jsonString: string): SafeParseResult<ResponsesOutputItemReasoningStatusUnion, SDKValidationError>;
/** @internal */
export declare const ResponsesOutputItemReasoning$inboundSchema: z.ZodType<ResponsesOutputItemReasoning, unknown>;
/** @internal */
export type ResponsesOutputItemReasoning$Outbound = {
    type: string;
    id: string;
    content?: Array<ReasoningTextContent$Outbound> | undefined;
    summary: Array<ReasoningSummaryText$Outbound>;
    encrypted_content?: string | null | undefined;
    status?: string | string | string | undefined;
};
/** @internal */
export declare const ResponsesOutputItemReasoning$outboundSchema: z.ZodType<ResponsesOutputItemReasoning$Outbound, ResponsesOutputItemReasoning>;
export declare function responsesOutputItemReasoningToJSON(responsesOutputItemReasoning: ResponsesOutputItemReasoning): string;
export declare function responsesOutputItemReasoningFromJSON(jsonString: string): SafeParseResult<ResponsesOutputItemReasoning, SDKValidationError>;
//# sourceMappingURL=responsesoutputitemreasoning.d.ts.map