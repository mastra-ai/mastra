import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Unauthorized - Authentication required or invalid credentials
 */
export type UnauthorizedResponseErrorData = {
    /**
     * Error data for UnauthorizedResponse
     */
    error: models.UnauthorizedResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Unauthorized - Authentication required or invalid credentials
 */
export declare class UnauthorizedResponseError extends OpenRouterError {
    /**
     * Error data for UnauthorizedResponse
     */
    error: models.UnauthorizedResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: UnauthorizedResponseErrorData;
    constructor(err: UnauthorizedResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const UnauthorizedResponseError$inboundSchema: z.ZodType<UnauthorizedResponseError, unknown>;
//# sourceMappingURL=unauthorizedresponseerror.d.ts.map