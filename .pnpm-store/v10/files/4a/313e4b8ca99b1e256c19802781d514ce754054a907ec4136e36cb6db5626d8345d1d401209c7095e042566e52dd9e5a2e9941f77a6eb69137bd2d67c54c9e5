import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Too Many Requests - Rate limit exceeded
 */
export type TooManyRequestsResponseErrorData = {
    /**
     * Error data for TooManyRequestsResponse
     */
    error: models.TooManyRequestsResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Too Many Requests - Rate limit exceeded
 */
export declare class TooManyRequestsResponseError extends OpenRouterError {
    /**
     * Error data for TooManyRequestsResponse
     */
    error: models.TooManyRequestsResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: TooManyRequestsResponseErrorData;
    constructor(err: TooManyRequestsResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const TooManyRequestsResponseError$inboundSchema: z.ZodType<TooManyRequestsResponseError, unknown>;
//# sourceMappingURL=toomanyrequestsresponseerror.d.ts.map