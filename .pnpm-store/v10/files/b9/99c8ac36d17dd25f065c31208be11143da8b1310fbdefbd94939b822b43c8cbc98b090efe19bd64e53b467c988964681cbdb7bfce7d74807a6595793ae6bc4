import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const OpenResponsesErrorEventType: {
    readonly Error: "error";
};
export type OpenResponsesErrorEventType = ClosedEnum<typeof OpenResponsesErrorEventType>;
/**
 * Event emitted when an error occurs during streaming
 */
export type OpenResponsesErrorEvent = {
    type: OpenResponsesErrorEventType;
    code: string | null;
    message: string;
    param: string | null;
    sequenceNumber: number;
};
/** @internal */
export declare const OpenResponsesErrorEventType$inboundSchema: z.ZodEnum<typeof OpenResponsesErrorEventType>;
/** @internal */
export declare const OpenResponsesErrorEvent$inboundSchema: z.ZodType<OpenResponsesErrorEvent, unknown>;
export declare function openResponsesErrorEventFromJSON(jsonString: string): SafeParseResult<OpenResponsesErrorEvent, SDKValidationError>;
//# sourceMappingURL=openresponseserrorevent.d.ts.map