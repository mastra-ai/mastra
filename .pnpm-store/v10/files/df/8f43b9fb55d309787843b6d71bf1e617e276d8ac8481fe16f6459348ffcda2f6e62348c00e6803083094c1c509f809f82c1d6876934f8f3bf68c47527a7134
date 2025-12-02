import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponsesSearchContextSize } from "./responsessearchcontextsize.js";
import { WebSearchPreviewToolUserLocation, WebSearchPreviewToolUserLocation$Outbound } from "./websearchpreviewtooluserlocation.js";
export declare const OpenResponsesWebSearchPreviewToolType: {
    readonly WebSearchPreview: "web_search_preview";
};
export type OpenResponsesWebSearchPreviewToolType = ClosedEnum<typeof OpenResponsesWebSearchPreviewToolType>;
/**
 * Web search preview tool configuration
 */
export type OpenResponsesWebSearchPreviewTool = {
    type: OpenResponsesWebSearchPreviewToolType;
    /**
     * Size of the search context for web search tools
     */
    searchContextSize?: ResponsesSearchContextSize | undefined;
    userLocation?: WebSearchPreviewToolUserLocation | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearchPreviewToolType$inboundSchema: z.ZodEnum<typeof OpenResponsesWebSearchPreviewToolType>;
/** @internal */
export declare const OpenResponsesWebSearchPreviewToolType$outboundSchema: z.ZodEnum<typeof OpenResponsesWebSearchPreviewToolType>;
/** @internal */
export declare const OpenResponsesWebSearchPreviewTool$inboundSchema: z.ZodType<OpenResponsesWebSearchPreviewTool, unknown>;
/** @internal */
export type OpenResponsesWebSearchPreviewTool$Outbound = {
    type: string;
    search_context_size?: string | undefined;
    user_location?: WebSearchPreviewToolUserLocation$Outbound | null | undefined;
};
/** @internal */
export declare const OpenResponsesWebSearchPreviewTool$outboundSchema: z.ZodType<OpenResponsesWebSearchPreviewTool$Outbound, OpenResponsesWebSearchPreviewTool>;
export declare function openResponsesWebSearchPreviewToolToJSON(openResponsesWebSearchPreviewTool: OpenResponsesWebSearchPreviewTool): string;
export declare function openResponsesWebSearchPreviewToolFromJSON(jsonString: string): SafeParseResult<OpenResponsesWebSearchPreviewTool, SDKValidationError>;
//# sourceMappingURL=openresponseswebsearchpreviewtool.d.ts.map