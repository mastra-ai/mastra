import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Infrastructure Timeout - Provider request timed out at edge network
 */
export type EdgeNetworkTimeoutResponseErrorData = {
    /**
     * Error data for EdgeNetworkTimeoutResponse
     */
    error: models.EdgeNetworkTimeoutResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Infrastructure Timeout - Provider request timed out at edge network
 */
export declare class EdgeNetworkTimeoutResponseError extends OpenRouterError {
    /**
     * Error data for EdgeNetworkTimeoutResponse
     */
    error: models.EdgeNetworkTimeoutResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: EdgeNetworkTimeoutResponseErrorData;
    constructor(err: EdgeNetworkTimeoutResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const EdgeNetworkTimeoutResponseError$inboundSchema: z.ZodType<EdgeNetworkTimeoutResponseError, unknown>;
//# sourceMappingURL=edgenetworktimeoutresponseerror.d.ts.map