import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OpenAIResponsesIncompleteDetails } from "./openairesponsesincompletedetails.js";
import { OpenAIResponsesInputUnion } from "./openairesponsesinputunion.js";
import { OpenAIResponsesPrompt } from "./openairesponsesprompt.js";
import { OpenAIResponsesReasoningConfig } from "./openairesponsesreasoningconfig.js";
import { OpenAIResponsesResponseStatus } from "./openairesponsesresponsestatus.js";
import { OpenAIResponsesServiceTier } from "./openairesponsesservicetier.js";
import { OpenAIResponsesToolChoiceUnion } from "./openairesponsestoolchoiceunion.js";
import { OpenAIResponsesTruncation } from "./openairesponsestruncation.js";
import { OpenResponsesUsage } from "./openresponsesusage.js";
import { OpenResponsesWebSearch20250826Tool } from "./openresponseswebsearch20250826tool.js";
import { OpenResponsesWebSearchPreview20250311Tool } from "./openresponseswebsearchpreview20250311tool.js";
import { OpenResponsesWebSearchPreviewTool } from "./openresponseswebsearchpreviewtool.js";
import { OpenResponsesWebSearchTool } from "./openresponseswebsearchtool.js";
import { ResponsesErrorField } from "./responseserrorfield.js";
import { ResponsesOutputItem } from "./responsesoutputitem.js";
import { ResponseTextConfig } from "./responsetextconfig.js";
export declare const ObjectT: {
    readonly Response: "response";
};
export type ObjectT = ClosedEnum<typeof ObjectT>;
export declare const OpenResponsesNonStreamingResponseType: {
    readonly Function: "function";
};
export type OpenResponsesNonStreamingResponseType = ClosedEnum<typeof OpenResponsesNonStreamingResponseType>;
/**
 * Function tool definition
 */
export type OpenResponsesNonStreamingResponseToolFunction = {
    type: OpenResponsesNonStreamingResponseType;
    name: string;
    description?: string | null | undefined;
    strict?: boolean | null | undefined;
    parameters: {
        [k: string]: any | null;
    } | null;
};
export type OpenResponsesNonStreamingResponseToolUnion = OpenResponsesNonStreamingResponseToolFunction | OpenResponsesWebSearchPreviewTool | OpenResponsesWebSearchPreview20250311Tool | OpenResponsesWebSearchTool | OpenResponsesWebSearch20250826Tool;
/**
 * Complete non-streaming response from the Responses API
 */
export type OpenResponsesNonStreamingResponse = {
    id: string;
    object: ObjectT;
    createdAt: number;
    model: string;
    status?: OpenAIResponsesResponseStatus | undefined;
    output: Array<ResponsesOutputItem>;
    user?: string | null | undefined;
    outputText?: string | undefined;
    promptCacheKey?: string | null | undefined;
    safetyIdentifier?: string | null | undefined;
    /**
     * Error information returned from the API
     */
    error: ResponsesErrorField | null;
    incompleteDetails: OpenAIResponsesIncompleteDetails | null;
    /**
     * Token usage information for the response
     */
    usage?: OpenResponsesUsage | undefined;
    maxToolCalls?: number | null | undefined;
    topLogprobs?: number | undefined;
    maxOutputTokens?: number | null | undefined;
    temperature: number | null;
    topP: number | null;
    instructions?: OpenAIResponsesInputUnion | null | undefined;
    /**
     * Metadata key-value pairs for the request. Keys must be ≤64 characters and cannot contain brackets. Values must be ≤512 characters. Maximum 16 pairs allowed.
     */
    metadata: {
        [k: string]: string;
    } | null;
    tools: Array<OpenResponsesNonStreamingResponseToolFunction | OpenResponsesWebSearchPreviewTool | OpenResponsesWebSearchPreview20250311Tool | OpenResponsesWebSearchTool | OpenResponsesWebSearch20250826Tool>;
    toolChoice: OpenAIResponsesToolChoiceUnion;
    parallelToolCalls: boolean;
    prompt?: OpenAIResponsesPrompt | null | undefined;
    background?: boolean | null | undefined;
    previousResponseId?: string | null | undefined;
    reasoning?: OpenAIResponsesReasoningConfig | null | undefined;
    serviceTier?: OpenAIResponsesServiceTier | null | undefined;
    store?: boolean | undefined;
    truncation?: OpenAIResponsesTruncation | null | undefined;
    /**
     * Text output configuration including format and verbosity
     */
    text?: ResponseTextConfig | undefined;
};
/** @internal */
export declare const ObjectT$inboundSchema: z.ZodEnum<typeof ObjectT>;
/** @internal */
export declare const OpenResponsesNonStreamingResponseType$inboundSchema: z.ZodEnum<typeof OpenResponsesNonStreamingResponseType>;
/** @internal */
export declare const OpenResponsesNonStreamingResponseToolFunction$inboundSchema: z.ZodType<OpenResponsesNonStreamingResponseToolFunction, unknown>;
export declare function openResponsesNonStreamingResponseToolFunctionFromJSON(jsonString: string): SafeParseResult<OpenResponsesNonStreamingResponseToolFunction, SDKValidationError>;
/** @internal */
export declare const OpenResponsesNonStreamingResponseToolUnion$inboundSchema: z.ZodType<OpenResponsesNonStreamingResponseToolUnion, unknown>;
export declare function openResponsesNonStreamingResponseToolUnionFromJSON(jsonString: string): SafeParseResult<OpenResponsesNonStreamingResponseToolUnion, SDKValidationError>;
/** @internal */
export declare const OpenResponsesNonStreamingResponse$inboundSchema: z.ZodType<OpenResponsesNonStreamingResponse, unknown>;
export declare function openResponsesNonStreamingResponseFromJSON(jsonString: string): SafeParseResult<OpenResponsesNonStreamingResponse, SDKValidationError>;
//# sourceMappingURL=openresponsesnonstreamingresponse.d.ts.map