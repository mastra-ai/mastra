import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponsesSearchContextSize } from "./responsessearchcontextsize.js";
import { ResponsesWebSearchUserLocation, ResponsesWebSearchUserLocation$Outbound } from "./responseswebsearchuserlocation.js";
export declare const OpenResponsesWebSearch20250826ToolType: {
    readonly WebSearch20250826: "web_search_2025_08_26";
};
export type OpenResponsesWebSearch20250826ToolType = ClosedEnum<typeof OpenResponsesWebSearch20250826ToolType>;
export type OpenResponsesWebSearch20250826ToolFilters = {
    allowedDomains?: Array<string> | null | undefined;
};
/**
 * Web search tool configuration (2025-08-26 version)
 */
export type OpenResponsesWebSearch20250826Tool = {
    type: OpenResponsesWebSearch20250826ToolType;
    filters?: OpenResponsesWebSearch20250826ToolFilters | null | undefined;
    /**
     * Size of the search context for web search tools
     */
    searchContextSize?: ResponsesSearchContextSize | undefined;
    /**
     * User location information for web search
     */
    userLocation?: ResponsesWebSearchUserLocation | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearch20250826ToolType$inboundSchema: z.ZodEnum<typeof OpenResponsesWebSearch20250826ToolType>;
/** @internal */
export declare const OpenResponsesWebSearch20250826ToolType$outboundSchema: z.ZodEnum<typeof OpenResponsesWebSearch20250826ToolType>;
/** @internal */
export declare const OpenResponsesWebSearch20250826ToolFilters$inboundSchema: z.ZodType<OpenResponsesWebSearch20250826ToolFilters, unknown>;
/** @internal */
export type OpenResponsesWebSearch20250826ToolFilters$Outbound = {
    allowed_domains?: Array<string> | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearch20250826ToolFilters$outboundSchema: z.ZodType<OpenResponsesWebSearch20250826ToolFilters$Outbound, OpenResponsesWebSearch20250826ToolFilters>;
export declare function openResponsesWebSearch20250826ToolFiltersToJSON(openResponsesWebSearch20250826ToolFilters: OpenResponsesWebSearch20250826ToolFilters): string;
export declare function openResponsesWebSearch20250826ToolFiltersFromJSON(jsonString: string): SafeParseResult<OpenResponsesWebSearch20250826ToolFilters, SDKValidationError>;
/** @internal */
export declare const OpenResponsesWebSearch20250826Tool$inboundSchema: z.ZodType<OpenResponsesWebSearch20250826Tool, unknown>;
/** @internal */
export type OpenResponsesWebSearch20250826Tool$Outbound = {
    type: string;
    filters?: OpenResponsesWebSearch20250826ToolFilters$Outbound | null | undefined;
    search_context_size?: string | undefined;
    user_location?: ResponsesWebSearchUserLocation$Outbound | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearch20250826Tool$outboundSchema: z.ZodType<OpenResponsesWebSearch20250826Tool$Outbound, OpenResponsesWebSearch20250826Tool>;
export declare function openResponsesWebSearch20250826ToolToJSON(openResponsesWebSearch20250826Tool: OpenResponsesWebSearch20250826Tool): string;
export declare function openResponsesWebSearch20250826ToolFromJSON(jsonString: string): SafeParseResult<OpenResponsesWebSearch20250826Tool, SDKValidationError>;
//# sourceMappingURL=openresponseswebsearch20250826tool.d.ts.map