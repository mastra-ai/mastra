import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OpenAIResponsesAnnotation } from "./openairesponsesannotation.js";
import { OpenAIResponsesRefusalContent } from "./openairesponsesrefusalcontent.js";
import { OpenResponsesErrorEvent } from "./openresponseserrorevent.js";
import { OpenResponsesImageGenCallCompleted } from "./openresponsesimagegencallcompleted.js";
import { OpenResponsesImageGenCallGenerating } from "./openresponsesimagegencallgenerating.js";
import { OpenResponsesImageGenCallInProgress } from "./openresponsesimagegencallinprogress.js";
import { OpenResponsesImageGenCallPartialImage } from "./openresponsesimagegencallpartialimage.js";
import { OpenResponsesLogProbs } from "./openresponseslogprobs.js";
import { OpenResponsesNonStreamingResponse } from "./openresponsesnonstreamingresponse.js";
import { OpenResponsesReasoningDeltaEvent } from "./openresponsesreasoningdeltaevent.js";
import { OpenResponsesReasoningDoneEvent } from "./openresponsesreasoningdoneevent.js";
import { OpenResponsesReasoningSummaryPartAddedEvent } from "./openresponsesreasoningsummarypartaddedevent.js";
import { OpenResponsesReasoningSummaryTextDeltaEvent } from "./openresponsesreasoningsummarytextdeltaevent.js";
import { OpenResponsesReasoningSummaryTextDoneEvent } from "./openresponsesreasoningsummarytextdoneevent.js";
import { ReasoningSummaryText } from "./reasoningsummarytext.js";
import { ReasoningTextContent } from "./reasoningtextcontent.js";
import { ResponseOutputText } from "./responseoutputtext.js";
import { ResponsesOutputItem } from "./responsesoutputitem.js";
export declare const TypeResponseReasoningSummaryPartDone: {
    readonly ResponseReasoningSummaryPartDone: "response.reasoning_summary_part.done";
};
export type TypeResponseReasoningSummaryPartDone = ClosedEnum<typeof TypeResponseReasoningSummaryPartDone>;
/**
 * Event emitted when a reasoning summary part is complete
 */
export type OpenResponsesStreamEventResponseReasoningSummaryPartDone = {
    type: TypeResponseReasoningSummaryPartDone;
    outputIndex: number;
    itemId: string;
    summaryIndex: number;
    part: ReasoningSummaryText;
    sequenceNumber: number;
};
export declare const TypeResponseFunctionCallArgumentsDone: {
    readonly ResponseFunctionCallArgumentsDone: "response.function_call_arguments.done";
};
export type TypeResponseFunctionCallArgumentsDone = ClosedEnum<typeof TypeResponseFunctionCallArgumentsDone>;
/**
 * Event emitted when function call arguments streaming is complete
 */
export type OpenResponsesStreamEventResponseFunctionCallArgumentsDone = {
    type: TypeResponseFunctionCallArgumentsDone;
    itemId: string;
    outputIndex: number;
    name: string;
    arguments: string;
    sequenceNumber: number;
};
export declare const TypeResponseFunctionCallArgumentsDelta: {
    readonly ResponseFunctionCallArgumentsDelta: "response.function_call_arguments.delta";
};
export type TypeResponseFunctionCallArgumentsDelta = ClosedEnum<typeof TypeResponseFunctionCallArgumentsDelta>;
/**
 * Event emitted when function call arguments are being streamed
 */
export type OpenResponsesStreamEventResponseFunctionCallArgumentsDelta = {
    type: TypeResponseFunctionCallArgumentsDelta;
    itemId: string;
    outputIndex: number;
    delta: string;
    sequenceNumber: number;
};
export declare const TypeResponseOutputTextAnnotationAdded: {
    readonly ResponseOutputTextAnnotationAdded: "response.output_text.annotation.added";
};
export type TypeResponseOutputTextAnnotationAdded = ClosedEnum<typeof TypeResponseOutputTextAnnotationAdded>;
/**
 * Event emitted when a text annotation is added to output
 */
export type OpenResponsesStreamEventResponseOutputTextAnnotationAdded = {
    type: TypeResponseOutputTextAnnotationAdded;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    sequenceNumber: number;
    annotationIndex: number;
    annotation: OpenAIResponsesAnnotation;
};
export declare const TypeResponseRefusalDone: {
    readonly ResponseRefusalDone: "response.refusal.done";
};
export type TypeResponseRefusalDone = ClosedEnum<typeof TypeResponseRefusalDone>;
/**
 * Event emitted when refusal streaming is complete
 */
export type OpenResponsesStreamEventResponseRefusalDone = {
    type: TypeResponseRefusalDone;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    refusal: string;
    sequenceNumber: number;
};
export declare const TypeResponseRefusalDelta: {
    readonly ResponseRefusalDelta: "response.refusal.delta";
};
export type TypeResponseRefusalDelta = ClosedEnum<typeof TypeResponseRefusalDelta>;
/**
 * Event emitted when a refusal delta is streamed
 */
export type OpenResponsesStreamEventResponseRefusalDelta = {
    type: TypeResponseRefusalDelta;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    delta: string;
    sequenceNumber: number;
};
export declare const TypeResponseOutputTextDone: {
    readonly ResponseOutputTextDone: "response.output_text.done";
};
export type TypeResponseOutputTextDone = ClosedEnum<typeof TypeResponseOutputTextDone>;
/**
 * Event emitted when text streaming is complete
 */
export type OpenResponsesStreamEventResponseOutputTextDone = {
    type: TypeResponseOutputTextDone;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    text: string;
    sequenceNumber: number;
    logprobs: Array<OpenResponsesLogProbs>;
};
export declare const TypeResponseOutputTextDelta: {
    readonly ResponseOutputTextDelta: "response.output_text.delta";
};
export type TypeResponseOutputTextDelta = ClosedEnum<typeof TypeResponseOutputTextDelta>;
/**
 * Event emitted when a text delta is streamed
 */
export type OpenResponsesStreamEventResponseOutputTextDelta = {
    type: TypeResponseOutputTextDelta;
    logprobs: Array<OpenResponsesLogProbs>;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    delta: string;
    sequenceNumber: number;
};
export declare const TypeResponseContentPartDone: {
    readonly ResponseContentPartDone: "response.content_part.done";
};
export type TypeResponseContentPartDone = ClosedEnum<typeof TypeResponseContentPartDone>;
export type Part2 = ResponseOutputText | ReasoningTextContent | OpenAIResponsesRefusalContent;
/**
 * Event emitted when a content part is complete
 */
export type OpenResponsesStreamEventResponseContentPartDone = {
    type: TypeResponseContentPartDone;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    part: ResponseOutputText | ReasoningTextContent | OpenAIResponsesRefusalContent;
    sequenceNumber: number;
};
export declare const TypeResponseContentPartAdded: {
    readonly ResponseContentPartAdded: "response.content_part.added";
};
export type TypeResponseContentPartAdded = ClosedEnum<typeof TypeResponseContentPartAdded>;
export type Part1 = ResponseOutputText | ReasoningTextContent | OpenAIResponsesRefusalContent;
/**
 * Event emitted when a new content part is added to an output item
 */
export type OpenResponsesStreamEventResponseContentPartAdded = {
    type: TypeResponseContentPartAdded;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    part: ResponseOutputText | ReasoningTextContent | OpenAIResponsesRefusalContent;
    sequenceNumber: number;
};
export declare const TypeResponseOutputItemDone: {
    readonly ResponseOutputItemDone: "response.output_item.done";
};
export type TypeResponseOutputItemDone = ClosedEnum<typeof TypeResponseOutputItemDone>;
/**
 * Event emitted when an output item is complete
 */
export type OpenResponsesStreamEventResponseOutputItemDone = {
    type: TypeResponseOutputItemDone;
    outputIndex: number;
    /**
     * An output item from the response
     */
    item: ResponsesOutputItem;
    sequenceNumber: number;
};
export declare const TypeResponseOutputItemAdded: {
    readonly ResponseOutputItemAdded: "response.output_item.added";
};
export type TypeResponseOutputItemAdded = ClosedEnum<typeof TypeResponseOutputItemAdded>;
/**
 * Event emitted when a new output item is added to the response
 */
export type OpenResponsesStreamEventResponseOutputItemAdded = {
    type: TypeResponseOutputItemAdded;
    outputIndex: number;
    /**
     * An output item from the response
     */
    item: ResponsesOutputItem;
    sequenceNumber: number;
};
export declare const TypeResponseFailed: {
    readonly ResponseFailed: "response.failed";
};
export type TypeResponseFailed = ClosedEnum<typeof TypeResponseFailed>;
/**
 * Event emitted when a response has failed
 */
export type OpenResponsesStreamEventResponseFailed = {
    type: TypeResponseFailed;
    /**
     * Complete non-streaming response from the Responses API
     */
    response: OpenResponsesNonStreamingResponse;
    sequenceNumber: number;
};
export declare const TypeResponseIncomplete: {
    readonly ResponseIncomplete: "response.incomplete";
};
export type TypeResponseIncomplete = ClosedEnum<typeof TypeResponseIncomplete>;
/**
 * Event emitted when a response is incomplete
 */
export type OpenResponsesStreamEventResponseIncomplete = {
    type: TypeResponseIncomplete;
    /**
     * Complete non-streaming response from the Responses API
     */
    response: OpenResponsesNonStreamingResponse;
    sequenceNumber: number;
};
export declare const TypeResponseCompleted: {
    readonly ResponseCompleted: "response.completed";
};
export type TypeResponseCompleted = ClosedEnum<typeof TypeResponseCompleted>;
/**
 * Event emitted when a response has completed successfully
 */
export type OpenResponsesStreamEventResponseCompleted = {
    type: TypeResponseCompleted;
    /**
     * Complete non-streaming response from the Responses API
     */
    response: OpenResponsesNonStreamingResponse;
    sequenceNumber: number;
};
export declare const TypeResponseInProgress: {
    readonly ResponseInProgress: "response.in_progress";
};
export type TypeResponseInProgress = ClosedEnum<typeof TypeResponseInProgress>;
/**
 * Event emitted when a response is in progress
 */
export type OpenResponsesStreamEventResponseInProgress = {
    type: TypeResponseInProgress;
    /**
     * Complete non-streaming response from the Responses API
     */
    response: OpenResponsesNonStreamingResponse;
    sequenceNumber: number;
};
export declare const TypeResponseCreated: {
    readonly ResponseCreated: "response.created";
};
export type TypeResponseCreated = ClosedEnum<typeof TypeResponseCreated>;
/**
 * Event emitted when a response is created
 */
export type OpenResponsesStreamEventResponseCreated = {
    type: TypeResponseCreated;
    /**
     * Complete non-streaming response from the Responses API
     */
    response: OpenResponsesNonStreamingResponse;
    sequenceNumber: number;
};
/**
 * Union of all possible event types emitted during response streaming
 */
export type OpenResponsesStreamEvent = OpenResponsesStreamEventResponseOutputTextDelta | OpenResponsesStreamEventResponseOutputTextDone | OpenResponsesStreamEventResponseOutputTextAnnotationAdded | OpenResponsesStreamEventResponseContentPartAdded | OpenResponsesStreamEventResponseContentPartDone | OpenResponsesStreamEventResponseRefusalDelta | OpenResponsesStreamEventResponseRefusalDone | OpenResponsesStreamEventResponseFunctionCallArgumentsDone | OpenResponsesReasoningDeltaEvent | OpenResponsesReasoningDoneEvent | OpenResponsesReasoningSummaryPartAddedEvent | OpenResponsesStreamEventResponseReasoningSummaryPartDone | OpenResponsesReasoningSummaryTextDeltaEvent | OpenResponsesReasoningSummaryTextDoneEvent | OpenResponsesImageGenCallPartialImage | OpenResponsesErrorEvent | OpenResponsesStreamEventResponseFunctionCallArgumentsDelta | OpenResponsesStreamEventResponseOutputItemAdded | OpenResponsesStreamEventResponseOutputItemDone | OpenResponsesImageGenCallInProgress | OpenResponsesImageGenCallGenerating | OpenResponsesImageGenCallCompleted | OpenResponsesStreamEventResponseCreated | OpenResponsesStreamEventResponseInProgress | OpenResponsesStreamEventResponseCompleted | OpenResponsesStreamEventResponseIncomplete | OpenResponsesStreamEventResponseFailed;
/** @internal */
export declare const TypeResponseReasoningSummaryPartDone$inboundSchema: z.ZodEnum<typeof TypeResponseReasoningSummaryPartDone>;
/** @internal */
export declare const OpenResponsesStreamEventResponseReasoningSummaryPartDone$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseReasoningSummaryPartDone, unknown>;
export declare function openResponsesStreamEventResponseReasoningSummaryPartDoneFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseReasoningSummaryPartDone, SDKValidationError>;
/** @internal */
export declare const TypeResponseFunctionCallArgumentsDone$inboundSchema: z.ZodEnum<typeof TypeResponseFunctionCallArgumentsDone>;
/** @internal */
export declare const OpenResponsesStreamEventResponseFunctionCallArgumentsDone$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseFunctionCallArgumentsDone, unknown>;
export declare function openResponsesStreamEventResponseFunctionCallArgumentsDoneFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseFunctionCallArgumentsDone, SDKValidationError>;
/** @internal */
export declare const TypeResponseFunctionCallArgumentsDelta$inboundSchema: z.ZodEnum<typeof TypeResponseFunctionCallArgumentsDelta>;
/** @internal */
export declare const OpenResponsesStreamEventResponseFunctionCallArgumentsDelta$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseFunctionCallArgumentsDelta, unknown>;
export declare function openResponsesStreamEventResponseFunctionCallArgumentsDeltaFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseFunctionCallArgumentsDelta, SDKValidationError>;
/** @internal */
export declare const TypeResponseOutputTextAnnotationAdded$inboundSchema: z.ZodEnum<typeof TypeResponseOutputTextAnnotationAdded>;
/** @internal */
export declare const OpenResponsesStreamEventResponseOutputTextAnnotationAdded$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseOutputTextAnnotationAdded, unknown>;
export declare function openResponsesStreamEventResponseOutputTextAnnotationAddedFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseOutputTextAnnotationAdded, SDKValidationError>;
/** @internal */
export declare const TypeResponseRefusalDone$inboundSchema: z.ZodEnum<typeof TypeResponseRefusalDone>;
/** @internal */
export declare const OpenResponsesStreamEventResponseRefusalDone$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseRefusalDone, unknown>;
export declare function openResponsesStreamEventResponseRefusalDoneFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseRefusalDone, SDKValidationError>;
/** @internal */
export declare const TypeResponseRefusalDelta$inboundSchema: z.ZodEnum<typeof TypeResponseRefusalDelta>;
/** @internal */
export declare const OpenResponsesStreamEventResponseRefusalDelta$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseRefusalDelta, unknown>;
export declare function openResponsesStreamEventResponseRefusalDeltaFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseRefusalDelta, SDKValidationError>;
/** @internal */
export declare const TypeResponseOutputTextDone$inboundSchema: z.ZodEnum<typeof TypeResponseOutputTextDone>;
/** @internal */
export declare const OpenResponsesStreamEventResponseOutputTextDone$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseOutputTextDone, unknown>;
export declare function openResponsesStreamEventResponseOutputTextDoneFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseOutputTextDone, SDKValidationError>;
/** @internal */
export declare const TypeResponseOutputTextDelta$inboundSchema: z.ZodEnum<typeof TypeResponseOutputTextDelta>;
/** @internal */
export declare const OpenResponsesStreamEventResponseOutputTextDelta$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseOutputTextDelta, unknown>;
export declare function openResponsesStreamEventResponseOutputTextDeltaFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseOutputTextDelta, SDKValidationError>;
/** @internal */
export declare const TypeResponseContentPartDone$inboundSchema: z.ZodEnum<typeof TypeResponseContentPartDone>;
/** @internal */
export declare const Part2$inboundSchema: z.ZodType<Part2, unknown>;
export declare function part2FromJSON(jsonString: string): SafeParseResult<Part2, SDKValidationError>;
/** @internal */
export declare const OpenResponsesStreamEventResponseContentPartDone$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseContentPartDone, unknown>;
export declare function openResponsesStreamEventResponseContentPartDoneFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseContentPartDone, SDKValidationError>;
/** @internal */
export declare const TypeResponseContentPartAdded$inboundSchema: z.ZodEnum<typeof TypeResponseContentPartAdded>;
/** @internal */
export declare const Part1$inboundSchema: z.ZodType<Part1, unknown>;
export declare function part1FromJSON(jsonString: string): SafeParseResult<Part1, SDKValidationError>;
/** @internal */
export declare const OpenResponsesStreamEventResponseContentPartAdded$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseContentPartAdded, unknown>;
export declare function openResponsesStreamEventResponseContentPartAddedFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseContentPartAdded, SDKValidationError>;
/** @internal */
export declare const TypeResponseOutputItemDone$inboundSchema: z.ZodEnum<typeof TypeResponseOutputItemDone>;
/** @internal */
export declare const OpenResponsesStreamEventResponseOutputItemDone$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseOutputItemDone, unknown>;
export declare function openResponsesStreamEventResponseOutputItemDoneFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseOutputItemDone, SDKValidationError>;
/** @internal */
export declare const TypeResponseOutputItemAdded$inboundSchema: z.ZodEnum<typeof TypeResponseOutputItemAdded>;
/** @internal */
export declare const OpenResponsesStreamEventResponseOutputItemAdded$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseOutputItemAdded, unknown>;
export declare function openResponsesStreamEventResponseOutputItemAddedFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseOutputItemAdded, SDKValidationError>;
/** @internal */
export declare const TypeResponseFailed$inboundSchema: z.ZodEnum<typeof TypeResponseFailed>;
/** @internal */
export declare const OpenResponsesStreamEventResponseFailed$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseFailed, unknown>;
export declare function openResponsesStreamEventResponseFailedFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseFailed, SDKValidationError>;
/** @internal */
export declare const TypeResponseIncomplete$inboundSchema: z.ZodEnum<typeof TypeResponseIncomplete>;
/** @internal */
export declare const OpenResponsesStreamEventResponseIncomplete$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseIncomplete, unknown>;
export declare function openResponsesStreamEventResponseIncompleteFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseIncomplete, SDKValidationError>;
/** @internal */
export declare const TypeResponseCompleted$inboundSchema: z.ZodEnum<typeof TypeResponseCompleted>;
/** @internal */
export declare const OpenResponsesStreamEventResponseCompleted$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseCompleted, unknown>;
export declare function openResponsesStreamEventResponseCompletedFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseCompleted, SDKValidationError>;
/** @internal */
export declare const TypeResponseInProgress$inboundSchema: z.ZodEnum<typeof TypeResponseInProgress>;
/** @internal */
export declare const OpenResponsesStreamEventResponseInProgress$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseInProgress, unknown>;
export declare function openResponsesStreamEventResponseInProgressFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseInProgress, SDKValidationError>;
/** @internal */
export declare const TypeResponseCreated$inboundSchema: z.ZodEnum<typeof TypeResponseCreated>;
/** @internal */
export declare const OpenResponsesStreamEventResponseCreated$inboundSchema: z.ZodType<OpenResponsesStreamEventResponseCreated, unknown>;
export declare function openResponsesStreamEventResponseCreatedFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEventResponseCreated, SDKValidationError>;
/** @internal */
export declare const OpenResponsesStreamEvent$inboundSchema: z.ZodType<OpenResponsesStreamEvent, unknown>;
export declare function openResponsesStreamEventFromJSON(jsonString: string): SafeParseResult<OpenResponsesStreamEvent, SDKValidationError>;
//# sourceMappingURL=openresponsesstreamevent.d.ts.map