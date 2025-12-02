import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { ChatGenerationTokenUsage } from "./chatgenerationtokenusage.js";
import { ChatResponseChoice } from "./chatresponsechoice.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type ChatResponse = {
    id: string;
    choices: Array<ChatResponseChoice>;
    created: number;
    model: string;
    object: "chat.completion";
    systemFingerprint?: string | null | undefined;
    usage?: ChatGenerationTokenUsage | undefined;
};
/** @internal */
export declare const ChatResponse$inboundSchema: z.ZodType<ChatResponse, unknown>;
export declare function chatResponseFromJSON(jsonString: string): SafeParseResult<ChatResponse, SDKValidationError>;
//# sourceMappingURL=chatresponse.d.ts.map