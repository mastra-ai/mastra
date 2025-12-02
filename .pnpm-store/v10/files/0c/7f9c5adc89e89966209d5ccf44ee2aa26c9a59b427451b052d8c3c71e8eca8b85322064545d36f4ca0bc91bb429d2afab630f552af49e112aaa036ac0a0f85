import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { ToolCallStatus } from "./toolcallstatus.js";
export declare const OpenResponsesFunctionCallOutputType: {
    readonly FunctionCallOutput: "function_call_output";
};
export type OpenResponsesFunctionCallOutputType = ClosedEnum<typeof OpenResponsesFunctionCallOutputType>;
/**
 * The output from a function call execution
 */
export type OpenResponsesFunctionCallOutput = {
    type: OpenResponsesFunctionCallOutputType;
    id?: string | null | undefined;
    callId: string;
    output: string;
    status?: ToolCallStatus | null | undefined;
};
/** @internal */
export declare const OpenResponsesFunctionCallOutputType$outboundSchema: z.ZodEnum<typeof OpenResponsesFunctionCallOutputType>;
/** @internal */
export type OpenResponsesFunctionCallOutput$Outbound = {
    type: string;
    id?: string | null | undefined;
    call_id: string;
    output: string;
    status?: string | null | undefined;
};
/** @internal */
export declare const OpenResponsesFunctionCallOutput$outboundSchema: z.ZodType<OpenResponsesFunctionCallOutput$Outbound, OpenResponsesFunctionCallOutput>;
export declare function openResponsesFunctionCallOutputToJSON(openResponsesFunctionCallOutput: OpenResponsesFunctionCallOutput): string;
//# sourceMappingURL=openresponsesfunctioncalloutput.d.ts.map