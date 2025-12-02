import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const WebSearchPreviewToolUserLocationType: {
    readonly Approximate: "approximate";
};
export type WebSearchPreviewToolUserLocationType = ClosedEnum<typeof WebSearchPreviewToolUserLocationType>;
export type WebSearchPreviewToolUserLocation = {
    type: WebSearchPreviewToolUserLocationType;
    city?: string | null | undefined;
    country?: string | null | undefined;
    region?: string | null | undefined;
    timezone?: string | null | undefined;
};
/** @internal */
export declare const WebSearchPreviewToolUserLocationType$inboundSchema: z.ZodEnum<typeof WebSearchPreviewToolUserLocationType>;
/** @internal */
export declare const WebSearchPreviewToolUserLocationType$outboundSchema: z.ZodEnum<typeof WebSearchPreviewToolUserLocationType>;
/** @internal */
export declare const WebSearchPreviewToolUserLocation$inboundSchema: z.ZodType<WebSearchPreviewToolUserLocation, unknown>;
/** @internal */
export type WebSearchPreviewToolUserLocation$Outbound = {
    type: string;
    city?: string | null | undefined;
    country?: string | null | undefined;
    region?: string | null | undefined;
    timezone?: string | null | undefined;
};
/** @internal */
export declare const WebSearchPreviewToolUserLocation$outboundSchema: z.ZodType<WebSearchPreviewToolUserLocation$Outbound, WebSearchPreviewToolUserLocation>;
export declare function webSearchPreviewToolUserLocationToJSON(webSearchPreviewToolUserLocation: WebSearchPreviewToolUserLocation): string;
export declare function webSearchPreviewToolUserLocationFromJSON(jsonString: string): SafeParseResult<WebSearchPreviewToolUserLocation, SDKValidationError>;
//# sourceMappingURL=websearchpreviewtooluserlocation.d.ts.map