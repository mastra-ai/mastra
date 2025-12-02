import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Request Timeout - Operation exceeded time limit
 */
export type RequestTimeoutResponseErrorData = {
    /**
     * Error data for RequestTimeoutResponse
     */
    error: models.RequestTimeoutResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Request Timeout - Operation exceeded time limit
 */
export declare class RequestTimeoutResponseError extends OpenRouterError {
    /**
     * Error data for RequestTimeoutResponse
     */
    error: models.RequestTimeoutResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: RequestTimeoutResponseErrorData;
    constructor(err: RequestTimeoutResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const RequestTimeoutResponseError$inboundSchema: z.ZodType<RequestTimeoutResponseError, unknown>;
//# sourceMappingURL=requesttimeoutresponseerror.d.ts.map