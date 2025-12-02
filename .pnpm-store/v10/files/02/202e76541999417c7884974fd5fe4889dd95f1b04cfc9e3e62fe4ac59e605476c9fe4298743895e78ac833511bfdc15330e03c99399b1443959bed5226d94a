import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponsesWebSearchUserLocationType: {
    readonly Approximate: "approximate";
};
export type ResponsesWebSearchUserLocationType = ClosedEnum<typeof ResponsesWebSearchUserLocationType>;
/**
 * User location information for web search
 */
export type ResponsesWebSearchUserLocation = {
    type?: ResponsesWebSearchUserLocationType | undefined;
    city?: string | null | undefined;
    country?: string | null | undefined;
    region?: string | null | undefined;
    timezone?: string | null | undefined;
};
/** @internal */
export declare const ResponsesWebSearchUserLocationType$inboundSchema: z.ZodEnum<typeof ResponsesWebSearchUserLocationType>;
/** @internal */
export declare const ResponsesWebSearchUserLocationType$outboundSchema: z.ZodEnum<typeof ResponsesWebSearchUserLocationType>;
/** @internal */
export declare const ResponsesWebSearchUserLocation$inboundSchema: z.ZodType<ResponsesWebSearchUserLocation, unknown>;
/** @internal */
export type ResponsesWebSearchUserLocation$Outbound = {
    type?: string | undefined;
    city?: string | null | undefined;
    country?: string | null | undefined;
    region?: string | null | undefined;
    timezone?: string | null | undefined;
};
/** @internal */
export declare const ResponsesWebSearchUserLocation$outboundSchema: z.ZodType<ResponsesWebSearchUserLocation$Outbound, ResponsesWebSearchUserLocation>;
export declare function responsesWebSearchUserLocationToJSON(responsesWebSearchUserLocation: ResponsesWebSearchUserLocation): string;
export declare function responsesWebSearchUserLocationFromJSON(jsonString: string): SafeParseResult<ResponsesWebSearchUserLocation, SDKValidationError>;
//# sourceMappingURL=responseswebsearchuserlocation.d.ts.map