import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesReasoningSummaryTextDoneEventType: {
    readonly ResponseReasoningSummaryTextDone: "response.reasoning_summary_text.done";
};
export type OpenResponsesReasoningSummaryTextDoneEventType = ClosedEnum<typeof OpenResponsesReasoningSummaryTextDoneEventType>;
/**
 * Event emitted when reasoning summary text streaming is complete
 */
export type OpenResponsesReasoningSummaryTextDoneEvent = {
    type: OpenResponsesReasoningSummaryTextDoneEventType;
    itemId: string;
    outputIndex: number;
    summaryIndex: number;
    text: string;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesReasoningSummaryTextDoneEventType$inboundSchema: z.ZodEnum<typeof OpenResponsesReasoningSummaryTextDoneEventType>;
/** @internal */
export declare const OpenResponsesReasoningSummaryTextDoneEvent$inboundSchema: z.ZodType<OpenResponsesReasoningSummaryTextDoneEvent, unknown>;
export declare function openResponsesReasoningSummaryTextDoneEventFromJSON(jsonString: string): SafeParseResult<OpenResponsesReasoningSummaryTextDoneEvent, SDKValidationError>;
//# sourceMappingURL=openresponsesreasoningsummarytextdoneevent.d.ts.map