import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesReasoningSummaryTextDeltaEventType: {
    readonly ResponseReasoningSummaryTextDelta: "response.reasoning_summary_text.delta";
};
export type OpenResponsesReasoningSummaryTextDeltaEventType = ClosedEnum<typeof OpenResponsesReasoningSummaryTextDeltaEventType>;
/**
 * Event emitted when reasoning summary text delta is streamed
 */
export type OpenResponsesReasoningSummaryTextDeltaEvent = {
    type: OpenResponsesReasoningSummaryTextDeltaEventType;
    itemId: string;
    outputIndex: number;
    summaryIndex: number;
    delta: string;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesReasoningSummaryTextDeltaEventType$inboundSchema: z.ZodEnum<typeof OpenResponsesReasoningSummaryTextDeltaEventType>;
/** @internal */
export declare const OpenResponsesReasoningSummaryTextDeltaEvent$inboundSchema: z.ZodType<OpenResponsesReasoningSummaryTextDeltaEvent, unknown>;
export declare function openResponsesReasoningSummaryTextDeltaEventFromJSON(jsonString: string): SafeParseResult<OpenResponsesReasoningSummaryTextDeltaEvent, SDKValidationError>;
//# sourceMappingURL=openresponsesreasoningsummarytextdeltaevent.d.ts.map