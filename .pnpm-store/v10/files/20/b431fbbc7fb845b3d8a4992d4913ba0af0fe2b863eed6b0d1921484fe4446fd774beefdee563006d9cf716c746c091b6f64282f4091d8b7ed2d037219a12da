import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
import * as models from "../index.js";
export type GetUserActivityRequest = {
    /**
     * Filter by a single UTC date in the last 30 days (YYYY-MM-DD format).
     */
    date?: string | undefined;
};
/**
 * Returns user activity data grouped by endpoint
 */
export type GetUserActivityResponse = {
    /**
     * List of activity items
     */
    data: Array<models.ActivityItem>;
};
/** @internal */
export type GetUserActivityRequest$Outbound = {
    date?: string | undefined;
};
/** @internal */
export declare const GetUserActivityRequest$outboundSchema: z.ZodType<GetUserActivityRequest$Outbound, GetUserActivityRequest>;
export declare function getUserActivityRequestToJSON(getUserActivityRequest: GetUserActivityRequest): string;
/** @internal */
export declare const GetUserActivityResponse$inboundSchema: z.ZodType<GetUserActivityResponse, unknown>;
export declare function getUserActivityResponseFromJSON(jsonString: string): SafeParseResult<GetUserActivityResponse, SDKValidationError>;
//# sourceMappingURL=getuseractivity.d.ts.map