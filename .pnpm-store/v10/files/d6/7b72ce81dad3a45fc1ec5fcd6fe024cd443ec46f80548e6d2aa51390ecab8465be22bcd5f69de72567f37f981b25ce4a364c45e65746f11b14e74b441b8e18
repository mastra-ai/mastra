import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type Code = string | number;
export type ChatErrorError = {
    code: string | number | null;
    message: string;
    param?: string | null | undefined;
    type?: string | null | undefined;
};
/** @internal */
export declare const Code$inboundSchema: z.ZodType<Code, unknown>;
export declare function codeFromJSON(jsonString: string): SafeParseResult<Code, SDKValidationError>;
/** @internal */
export declare const ChatErrorError$inboundSchema: z.ZodType<ChatErrorError, unknown>;
export declare function chatErrorErrorFromJSON(jsonString: string): SafeParseResult<ChatErrorError, SDKValidationError>;
//# sourceMappingURL=chaterror.d.ts.map