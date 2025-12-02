import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const URLCitationType: {
    readonly UrlCitation: "url_citation";
};
export type URLCitationType = ClosedEnum<typeof URLCitationType>;
export type URLCitation = {
    type: URLCitationType;
    url: string;
    title: string;
    startIndex: number;
    endIndex: number;
};
/** @internal */
export declare const URLCitationType$inboundSchema: z.ZodEnum<typeof URLCitationType>;
/** @internal */
export declare const URLCitationType$outboundSchema: z.ZodEnum<typeof URLCitationType>;
/** @internal */
export declare const URLCitation$inboundSchema: z.ZodType<URLCitation, unknown>;
/** @internal */
export type URLCitation$Outbound = {
    type: string;
    url: string;
    title: string;
    start_index: number;
    end_index: number;
};
/** @internal */
export declare const URLCitation$outboundSchema: z.ZodType<URLCitation$Outbound, URLCitation>;
export declare function urlCitationToJSON(urlCitation: URLCitation): string;
export declare function urlCitationFromJSON(jsonString: string): SafeParseResult<URLCitation, SDKValidationError>;
//# sourceMappingURL=urlcitation.d.ts.map