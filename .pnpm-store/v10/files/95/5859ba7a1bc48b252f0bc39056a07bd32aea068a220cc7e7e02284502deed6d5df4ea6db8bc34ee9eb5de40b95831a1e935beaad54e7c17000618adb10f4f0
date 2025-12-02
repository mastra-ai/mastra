import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponseFormatTextConfig } from "./responseformattextconfig.js";
export declare const ResponseTextConfigVerbosity: {
    readonly High: "high";
    readonly Low: "low";
    readonly Medium: "medium";
};
export type ResponseTextConfigVerbosity = OpenEnum<typeof ResponseTextConfigVerbosity>;
/**
 * Text output configuration including format and verbosity
 */
export type ResponseTextConfig = {
    /**
     * Text response format configuration
     */
    format?: ResponseFormatTextConfig | undefined;
    verbosity?: ResponseTextConfigVerbosity | null | undefined;
};
/** @internal */
export declare const ResponseTextConfigVerbosity$inboundSchema: z.ZodType<ResponseTextConfigVerbosity, unknown>;
/** @internal */
export declare const ResponseTextConfig$inboundSchema: z.ZodType<ResponseTextConfig, unknown>;
export declare function responseTextConfigFromJSON(jsonString: string): SafeParseResult<ResponseTextConfig, SDKValidationError>;
//# sourceMappingURL=responsetextconfig.d.ts.map