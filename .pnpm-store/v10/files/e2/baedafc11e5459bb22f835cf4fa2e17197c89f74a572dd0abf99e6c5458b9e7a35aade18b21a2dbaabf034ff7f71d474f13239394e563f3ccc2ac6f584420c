import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { ChatMessageTokenLogprob } from "./chatmessagetokenlogprob.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type ChatMessageTokenLogprobs = {
    content: Array<ChatMessageTokenLogprob> | null;
    refusal: Array<ChatMessageTokenLogprob> | null;
};
/** @internal */
export declare const ChatMessageTokenLogprobs$inboundSchema: z.ZodType<ChatMessageTokenLogprobs, unknown>;
export declare function chatMessageTokenLogprobsFromJSON(jsonString: string): SafeParseResult<ChatMessageTokenLogprobs, SDKValidationError>;
//# sourceMappingURL=chatmessagetokenlogprobs.d.ts.map