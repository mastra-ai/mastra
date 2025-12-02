import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { WebSearchStatus } from "./websearchstatus.js";
export declare const ResponsesOutputItemFileSearchCallType: {
    readonly FileSearchCall: "file_search_call";
};
export type ResponsesOutputItemFileSearchCallType = ClosedEnum<typeof ResponsesOutputItemFileSearchCallType>;
export type ResponsesOutputItemFileSearchCall = {
    type: ResponsesOutputItemFileSearchCallType;
    id: string;
    queries: Array<string>;
    status: WebSearchStatus;
};
/** @internal */
export declare const ResponsesOutputItemFileSearchCallType$inboundSchema: z.ZodEnum<typeof ResponsesOutputItemFileSearchCallType>;
/** @internal */
export declare const ResponsesOutputItemFileSearchCallType$outboundSchema: z.ZodEnum<typeof ResponsesOutputItemFileSearchCallType>;
/** @internal */
export declare const ResponsesOutputItemFileSearchCall$inboundSchema: z.ZodType<ResponsesOutputItemFileSearchCall, unknown>;
/** @internal */
export type ResponsesOutputItemFileSearchCall$Outbound = {
    type: string;
    id: string;
    queries: Array<string>;
    status: string;
};
/** @internal */
export declare const ResponsesOutputItemFileSearchCall$outboundSchema: z.ZodType<ResponsesOutputItemFileSearchCall$Outbound, ResponsesOutputItemFileSearchCall>;
export declare function responsesOutputItemFileSearchCallToJSON(responsesOutputItemFileSearchCall: ResponsesOutputItemFileSearchCall): string;
export declare function responsesOutputItemFileSearchCallFromJSON(jsonString: string): SafeParseResult<ResponsesOutputItemFileSearchCall, SDKValidationError>;
//# sourceMappingURL=responsesoutputitemfilesearchcall.d.ts.map