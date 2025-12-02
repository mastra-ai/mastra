import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type TopLogprob = {
    token: string;
    logprob: number;
    bytes: Array<number> | null;
};
export type ChatMessageTokenLogprob = {
    token: string;
    logprob: number;
    bytes: Array<number> | null;
    topLogprobs: Array<TopLogprob>;
};
/** @internal */
export declare const TopLogprob$inboundSchema: z.ZodType<TopLogprob, unknown>;
export declare function topLogprobFromJSON(jsonString: string): SafeParseResult<TopLogprob, SDKValidationError>;
/** @internal */
export declare const ChatMessageTokenLogprob$inboundSchema: z.ZodType<ChatMessageTokenLogprob, unknown>;
export declare function chatMessageTokenLogprobFromJSON(jsonString: string): SafeParseResult<ChatMessageTokenLogprob, SDKValidationError>;
//# sourceMappingURL=chatmessagetokenlogprob.d.ts.map