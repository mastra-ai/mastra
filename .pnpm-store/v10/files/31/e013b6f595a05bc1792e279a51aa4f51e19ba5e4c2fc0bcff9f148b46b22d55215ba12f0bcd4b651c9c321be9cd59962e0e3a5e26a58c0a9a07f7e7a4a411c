import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponsesSearchContextSize } from "./responsessearchcontextsize.js";
import { ResponsesWebSearchUserLocation, ResponsesWebSearchUserLocation$Outbound } from "./responseswebsearchuserlocation.js";
export declare const OpenResponsesWebSearchToolType: {
    readonly WebSearch: "web_search";
};
export type OpenResponsesWebSearchToolType = ClosedEnum<typeof OpenResponsesWebSearchToolType>;
export type OpenResponsesWebSearchToolFilters = {
    allowedDomains?: Array<string> | null | undefined;
};
/**
 * Web search tool configuration
 */
export type OpenResponsesWebSearchTool = {
    type: OpenResponsesWebSearchToolType;
    filters?: OpenResponsesWebSearchToolFilters | null | undefined;
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
export declare const OpenResponsesWebSearchToolType$inboundSchema: z.ZodEnum<typeof OpenResponsesWebSearchToolType>;
/** @internal */
export declare const OpenResponsesWebSearchToolType$outboundSchema: z.ZodEnum<typeof OpenResponsesWebSearchToolType>;
/** @internal */
export declare const OpenResponsesWebSearchToolFilters$inboundSchema: z.ZodType<OpenResponsesWebSearchToolFilters, unknown>;
/** @internal */
export type OpenResponsesWebSearchToolFilters$Outbound = {
    allowed_domains?: Array<string> | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearchToolFilters$outboundSchema: z.ZodType<OpenResponsesWebSearchToolFilters$Outbound, OpenResponsesWebSearchToolFilters>;
export declare function openResponsesWebSearchToolFiltersToJSON(openResponsesWebSearchToolFilters: OpenResponsesWebSearchToolFilters): string;
export declare function openResponsesWebSearchToolFiltersFromJSON(jsonString: string): SafeParseResult<OpenResponsesWebSearchToolFilters, SDKValidationError>;
/** @internal */
export declare const OpenResponsesWebSearchTool$inboundSchema: z.ZodType<OpenResponsesWebSearchTool, unknown>;
/** @internal */
export type OpenResponsesWebSearchTool$Outbound = {
    type: string;
    filters?: OpenResponsesWebSearchToolFilters$Outbound | null | undefined;
    search_context_size?: string | undefined;
    user_location?: ResponsesWebSearchUserLocation$Outbound | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearchTool$outboundSchema: z.ZodType<OpenResponsesWebSearchTool$Outbound, OpenResponsesWebSearchTool>;
export declare function openResponsesWebSearchToolToJSON(openResponsesWebSearchTool: OpenResponsesWebSearchTool): string;
export declare function openResponsesWebSearchToolFromJSON(jsonString: string): SafeParseResult<OpenResponsesWebSearchTool, SDKValidationError>;
//# sourceMappingURL=openresponseswebsearchtool.d.ts.map