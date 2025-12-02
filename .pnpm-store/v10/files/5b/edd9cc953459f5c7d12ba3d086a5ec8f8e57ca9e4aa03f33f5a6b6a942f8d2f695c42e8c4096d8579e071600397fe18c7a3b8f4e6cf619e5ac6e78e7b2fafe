import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Forbidden - Authentication successful but insufficient permissions
 */
export type ForbiddenResponseErrorData = {
    /**
     * Error data for ForbiddenResponse
     */
    error: models.ForbiddenResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Forbidden - Authentication successful but insufficient permissions
 */
export declare class ForbiddenResponseError extends OpenRouterError {
    /**
     * Error data for ForbiddenResponse
     */
    error: models.ForbiddenResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: ForbiddenResponseErrorData;
    constructor(err: ForbiddenResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const ForbiddenResponseError$inboundSchema: z.ZodType<ForbiddenResponseError, unknown>;
//# sourceMappingURL=forbiddenresponseerror.d.ts.map