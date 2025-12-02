import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesReasoningDoneEventType: {
    readonly ResponseReasoningTextDone: "response.reasoning_text.done";
};
export type OpenResponsesReasoningDoneEventType = ClosedEnum<typeof OpenResponsesReasoningDoneEventType>;
/**
 * Event emitted when reasoning text streaming is complete
 */
export type OpenResponsesReasoningDoneEvent = {
    type: OpenResponsesReasoningDoneEventType;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    text: string;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesReasoningDoneEventType$inboundSchema: z.ZodEnum<typeof OpenResponsesReasoningDoneEventType>;
/** @internal */
export declare const OpenResponsesReasoningDoneEvent$inboundSchema: z.ZodType<OpenResponsesReasoningDoneEvent, unknown>;
export declare function openResponsesReasoningDoneEventFromJSON(jsonString: string): SafeParseResult<OpenResponsesReasoningDoneEvent, SDKValidationError>;
//# sourceMappingURL=openresponsesreasoningdoneevent.d.ts.map