import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponsesOutputItemFunctionCallType: {
    readonly FunctionCall: "function_call";
};
export type ResponsesOutputItemFunctionCallType = ClosedEnum<typeof ResponsesOutputItemFunctionCallType>;
export declare const ResponsesOutputItemFunctionCallStatusInProgress: {
    readonly InProgress: "in_progress";
};
export type ResponsesOutputItemFunctionCallStatusInProgress = ClosedEnum<typeof ResponsesOutputItemFunctionCallStatusInProgress>;
export declare const ResponsesOutputItemFunctionCallStatusIncomplete: {
    readonly Incomplete: "incomplete";
};
export type ResponsesOutputItemFunctionCallStatusIncomplete = ClosedEnum<typeof ResponsesOutputItemFunctionCallStatusIncomplete>;
export declare const ResponsesOutputItemFunctionCallStatusCompleted: {
    readonly Completed: "completed";
};
export type ResponsesOutputItemFunctionCallStatusCompleted = ClosedEnum<typeof ResponsesOutputItemFunctionCallStatusCompleted>;
export type ResponsesOutputItemFunctionCallStatusUnion = ResponsesOutputItemFunctionCallStatusCompleted | ResponsesOutputItemFunctionCallStatusIncomplete | ResponsesOutputItemFunctionCallStatusInProgress;
export type ResponsesOutputItemFunctionCall = {
    type: ResponsesOutputItemFunctionCallType;
    id?: string | undefined;
    name: string;
    arguments: string;
    callId: string;
    status?: ResponsesOutputItemFunctionCallStatusCompleted | ResponsesOutputItemFunctionCallStatusIncomplete | ResponsesOutputItemFunctionCallStatusInProgress | undefined;
};
/** @internal */
export declare const ResponsesOutputItemFunctionCallType$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallType>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallType$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallType>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusInProgress$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallStatusInProgress>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusInProgress$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallStatusInProgress>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusIncomplete$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallStatusIncomplete>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusIncomplete$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallStatusIncomplete>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusCompleted$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallStatusCompleted>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusCompleted$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemFunctionCallStatusCompleted>;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusUnion$inboundSchema: z.ZodType<ResponsesOutputItemFunctionCallStatusUnion, unknown>;
/** @internal */
export type ResponsesOutputItemFunctionCallStatusUnion$Outbound = string | string | string;
/** @internal */
export declare const ResponsesOutputItemFunctionCallStatusUnion$outboundSchema: z.ZodType<ResponsesOutputItemFunctionCallStatusUnion$Outbound, ResponsesOutputItemFunctionCallStatusUnion>;
export declare function responsesOutputItemFunctionCallStatusUnionToJSON(responsesOutputItemFunctionCallStatusUnion: ResponsesOutputItemFunctionCallStatusUnion): string;
export declare function responsesOutputItemFunctionCallStatusUnionFromJSON(jsonString: string): SafeParseResult<ResponsesOutputItemFunctionCallStatusUnion, SDKValidationError>;
/** @internal */
export declare const ResponsesOutputItemFunctionCall$inboundSchema: z.ZodType<ResponsesOutputItemFunctionCall, unknown>;
/** @internal */
export type ResponsesOutputItemFunctionCall$Outbound = {
    type: string;
    id?: string | undefined;
    name: string;
    arguments: string;
    call_id: string;
    status?: string | string | string | undefined;
};
/** @internal */
export declare const ResponsesOutputItemFunctionCall$outboundSchema: z.ZodType<ResponsesOutputItemFunctionCall$Outbound, ResponsesOutputItemFunctionCall>;
export declare function responsesOutputItemFunctionCallToJSON(responsesOutputItemFunctionCall: ResponsesOutputItemFunctionCall): string;
export declare function responsesOutputItemFunctionCallFromJSON(jsonString: string): SafeParseResult<ResponsesOutputItemFunctionCall, SDKValidationError>;
//# sourceMappingURL=responsesoutputitemfunctioncall.d.ts.map