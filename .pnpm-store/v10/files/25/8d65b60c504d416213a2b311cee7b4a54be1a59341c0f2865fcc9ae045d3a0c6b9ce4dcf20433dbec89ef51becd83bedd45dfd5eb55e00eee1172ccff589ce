import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponsesSearchContextSize } from "./responsessearchcontextsize.js";
import { WebSearchPreviewToolUserLocation, WebSearchPreviewToolUserLocation$Outbound } from "./websearchpreviewtooluserlocation.js";
export declare const OpenResponsesWebSearchPreview20250311ToolType: {
    readonly WebSearchPreview20250311: "web_search_preview_2025_03_11";
};
export type OpenResponsesWebSearchPreview20250311ToolType = ClosedEnum<typeof OpenResponsesWebSearchPreview20250311ToolType>;
/**
 * Web search preview tool configuration (2025-03-11 version)
 */
export type OpenResponsesWebSearchPreview20250311Tool = {
    type: OpenResponsesWebSearchPreview20250311ToolType;
    /**
     * Size of the search context for web search tools
     */
    searchContextSize?: ResponsesSearchContextSize | undefined;
    userLocation?: WebSearchPreviewToolUserLocation | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearchPreview20250311ToolType$inboundSchema: z.ZodEnum<typeof OpenResponsesWebSearchPreview20250311ToolType>;
/** @internal */
export declare const OpenResponsesWebSearchPreview20250311ToolType$outboundSchema: z.ZodEnum<typeof OpenResponsesWebSearchPreview20250311ToolType>;
/** @internal */
export declare const OpenResponsesWebSearchPreview20250311Tool$inboundSchema: z.ZodType<OpenResponsesWebSearchPreview20250311Tool, unknown>;
/** @internal */
export type OpenResponsesWebSearchPreview20250311Tool$Outbound = {
    type: string;
    search_context_size?: string | undefined;
    user_location?: WebSearchPreviewToolUserLocation$Outbound | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearchPreview20250311Tool$outboundSchema: z.ZodType<OpenResponsesWebSearchPreview20250311Tool$Outbound, OpenResponsesWebSearchPreview20250311Tool>;
export declare function openResponsesWebSearchPreview20250311ToolToJSON(openResponsesWebSearchPreview20250311Tool: OpenResponsesWebSearchPreview20250311Tool): string;
export declare function openResponsesWebSearchPreview20250311ToolFromJSON(jsonString: string): SafeParseResult<OpenResponsesWebSearchPreview20250311Tool, SDKValidationError>;
//# sourceMappingURL=openresponseswebsearchpreview20250311tool.d.ts.map