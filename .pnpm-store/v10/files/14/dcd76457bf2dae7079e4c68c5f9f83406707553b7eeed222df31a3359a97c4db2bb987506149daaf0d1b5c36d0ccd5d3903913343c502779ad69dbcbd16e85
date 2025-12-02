import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { ResponseFormatTextConfig, ResponseFormatTextConfig$Outbound } from "./responseformattextconfig.js";
export declare const OpenResponsesResponseTextVerbosity: {
    readonly High: "high";
    readonly Low: "low";
    readonly Medium: "medium";
};
export type OpenResponsesResponseTextVerbosity = OpenEnum<typeof OpenResponsesResponseTextVerbosity>;
/**
 * Text output configuration including format and verbosity
 */
export type OpenResponsesResponseText = {
    /**
     * Text response format configuration
     */
    format?: ResponseFormatTextConfig | undefined;
    verbosity?: OpenResponsesResponseTextVerbosity | null | undefined;
};
/** @internal */
export declare const OpenResponsesResponseTextVerbosity$outboundSchema: z.ZodType<string, OpenResponsesResponseTextVerbosity>;
/** @internal */
export type OpenResponsesResponseText$Outbound = {
    format?: ResponseFormatTextConfig$Outbound | undefined;
    verbosity?: string | null | undefined;
};
/** @internal */
export declare const OpenResponsesResponseText$outboundSchema: z.ZodType<OpenResponsesResponseText$Outbound, OpenResponsesResponseText>;
export declare function openResponsesResponseTextToJSON(openResponsesResponseText: OpenResponsesResponseText): string;
//# sourceMappingURL=openresponsesresponsetext.d.ts.map