import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { ToolCallStatus } from "./toolcallstatus.js";
export declare const OpenResponsesFunctionToolCallType: {
    readonly FunctionCall: "function_call";
};
export type OpenResponsesFunctionToolCallType = ClosedEnum<typeof OpenResponsesFunctionToolCallType>;
/**
 * A function call initiated by the model
 */
export type OpenResponsesFunctionToolCall = {
    type: OpenResponsesFunctionToolCallType;
    callId: string;
    name: string;
    arguments: string;
    id: string;
    status?: ToolCallStatus | null | undefined;
};
/** @internal */
export declare const OpenResponsesFunctionToolCallType$outboundSchema: z.ZodEnum<typeof OpenResponsesFunctionToolCallType>;
/** @internal */
export type OpenResponsesFunctionToolCall$Outbound = {
    type: string;
    call_id: string;
    name: string;
    arguments: string;
    id: string;
    status?: string | null | undefined;
};
/** @internal */
export declare const OpenResponsesFunctionToolCall$outboundSchema: z.ZodType<OpenResponsesFunctionToolCall$Outbound, OpenResponsesFunctionToolCall>;
export declare function openResponsesFunctionToolCallToJSON(openResponsesFunctionToolCall: OpenResponsesFunctionToolCall): string;
//# sourceMappingURL=openresponsesfunctiontoolcall.d.ts.map