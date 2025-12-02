import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ReasoningSummaryTextType: {
    readonly SummaryText: "summary_text";
};
export type ReasoningSummaryTextType = ClosedEnum<typeof ReasoningSummaryTextType>;
export type ReasoningSummaryText = {
    type: ReasoningSummaryTextType;
    text: string;
};
/** @internal */
export declare const ReasoningSummaryTextType$inboundSchema: z.ZodEnum<typeof ReasoningSummaryTextType>;
/** @internal */
export declare const ReasoningSummaryTextType$outboundSchema: z.ZodEnum<typeof ReasoningSummaryTextType>;
/** @internal */
export declare const ReasoningSummaryText$inboundSchema: z.ZodType<ReasoningSummaryText, unknown>;
/** @internal */
export type ReasoningSummaryText$Outbound = {
    type: string;
    text: string;
};
/** @internal */
export declare const ReasoningSummaryText$outboundSchema: z.ZodType<ReasoningSummaryText$Outbound, ReasoningSummaryText>;
export declare function reasoningSummaryTextToJSON(reasoningSummaryText: ReasoningSummaryText): string;
export declare function reasoningSummaryTextFromJSON(jsonString: string): SafeParseResult<ReasoningSummaryText, SDKValidationError>;
//# sourceMappingURL=reasoningsummarytext.d.ts.map