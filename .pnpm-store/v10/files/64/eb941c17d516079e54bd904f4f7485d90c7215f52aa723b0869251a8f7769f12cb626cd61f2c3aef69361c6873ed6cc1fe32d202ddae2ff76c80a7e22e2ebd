import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
import * as models from "../index.js";
export type ListEndpointsRequest = {
    author: string;
    slug: string;
};
/**
 * Returns a list of endpoints
 */
export type ListEndpointsResponse = {
    /**
     * List of available endpoints for a model
     */
    data: models.ListEndpointsResponse;
};
/** @internal */
export type ListEndpointsRequest$Outbound = {
    author: string;
    slug: string;
};
/** @internal */
export declare const ListEndpointsRequest$outboundSchema: z.ZodType<ListEndpointsRequest$Outbound, ListEndpointsRequest>;
export declare function listEndpointsRequestToJSON(listEndpointsRequest: ListEndpointsRequest): string;
/** @internal */
export declare const ListEndpointsResponse$inboundSchema: z.ZodType<ListEndpointsResponse, unknown>;
export declare function listEndpointsResponseFromJSON(jsonString: string): SafeParseResult<ListEndpointsResponse, SDKValidationError>;
//# sourceMappingURL=listendpoints.d.ts.map