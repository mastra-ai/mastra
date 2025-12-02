import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ReasoningSummaryText } from "./reasoningsummarytext.js";
export declare const OpenResponsesReasoningSummaryPartAddedEventType: {
    readonly ResponseReasoningSummaryPartAdded: "response.reasoning_summary_part.added";
};
export type OpenResponsesReasoningSummaryPartAddedEventType = ClosedEnum<typeof OpenResponsesReasoningSummaryPartAddedEventType>;
/**
 * Event emitted when a reasoning summary part is added
 */
export type OpenResponsesReasoningSummaryPartAddedEvent = {
    type: OpenResponsesReasoningSummaryPartAddedEventType;
    outputIndex: number;
    itemId: string;
    summaryIndex: number;
    part: ReasoningSummaryText;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesReasoningSummaryPartAddedEventType$inboundSchema: z.ZodEnum<typeof OpenResponsesReasoningSummaryPartAddedEventType>;
/** @internal */
export declare const OpenResponsesReasoningSummaryPartAddedEvent$inboundSchema: z.ZodType<OpenResponsesReasoningSummaryPartAddedEvent, unknown>;
export declare function openResponsesReasoningSummaryPartAddedEventFromJSON(jsonString: string): SafeParseResult<OpenResponsesReasoningSummaryPartAddedEvent, SDKValidationError>;
//# sourceMappingURL=openresponsesreasoningsummarypartaddedevent.d.ts.map