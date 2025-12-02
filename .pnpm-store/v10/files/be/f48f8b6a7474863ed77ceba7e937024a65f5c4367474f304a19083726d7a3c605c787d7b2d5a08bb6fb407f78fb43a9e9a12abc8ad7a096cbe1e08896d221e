import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesReasoningDeltaEventType: {
    readonly ResponseReasoningTextDelta: "response.reasoning_text.delta";
};
export type OpenResponsesReasoningDeltaEventType = ClosedEnum<typeof OpenResponsesReasoningDeltaEventType>;
/**
 * Event emitted when reasoning text delta is streamed
 */
export type OpenResponsesReasoningDeltaEvent = {
    type: OpenResponsesReasoningDeltaEventType;
    outputIndex: number;
    itemId: string;
    contentIndex: number;
    delta: string;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesReasoningDeltaEventType$inboundSchema: z.ZodEnum<typeof OpenResponsesReasoningDeltaEventType>;
/** @internal */
export declare const OpenResponsesReasoningDeltaEvent$inboundSchema: z.ZodType<OpenResponsesReasoningDeltaEvent, unknown>;
export declare function openResponsesReasoningDeltaEventFromJSON(jsonString: string): SafeParseResult<OpenResponsesReasoningDeltaEvent, SDKValidationError>;
//# sourceMappingURL=openresponsesreasoningdeltaevent.d.ts.map