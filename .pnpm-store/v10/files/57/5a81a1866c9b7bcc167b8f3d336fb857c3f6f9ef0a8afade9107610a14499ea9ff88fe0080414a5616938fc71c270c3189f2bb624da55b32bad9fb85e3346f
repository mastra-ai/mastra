import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { WebSearchStatus } from "./websearchstatus.js";
export declare const ResponsesWebSearchCallOutputType: {
    readonly WebSearchCall: "web_search_call";
};
export type ResponsesWebSearchCallOutputType = ClosedEnum<typeof ResponsesWebSearchCallOutputType>;
export type ResponsesWebSearchCallOutput = {
    type: ResponsesWebSearchCallOutputType;
    id: string;
    status: WebSearchStatus;
};
/** @internal */
export declare const ResponsesWebSearchCallOutputType$inboundSchema: z.ZodEnum<typeof ResponsesWebSearchCallOutputType>;
/** @internal */
export declare const ResponsesWebSearchCallOutputType$outboundSchema: z.ZodEnum<typeof ResponsesWebSearchCallOutputType>;
/** @internal */
export declare const ResponsesWebSearchCallOutput$inboundSchema: z.ZodType<ResponsesWebSearchCallOutput, unknown>;
/** @internal */
export type ResponsesWebSearchCallOutput$Outbound = {
    type: string;
    id: string;
    status: string;
};
/** @internal */
export declare const ResponsesWebSearchCallOutput$outboundSchema: z.ZodType<ResponsesWebSearchCallOutput$Outbound, ResponsesWebSearchCallOutput>;
export declare function responsesWebSearchCallOutputToJSON(responsesWebSearchCallOutput: ResponsesWebSearchCallOutput): string;
export declare function responsesWebSearchCallOutputFromJSON(jsonString: string): SafeParseResult<ResponsesWebSearchCallOutput, SDKValidationError>;
//# sourceMappingURL=responseswebsearchcalloutput.d.ts.map