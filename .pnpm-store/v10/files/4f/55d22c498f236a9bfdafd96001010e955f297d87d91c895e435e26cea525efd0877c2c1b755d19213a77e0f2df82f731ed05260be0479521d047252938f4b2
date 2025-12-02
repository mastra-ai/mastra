import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Bad Request - Invalid request parameters or malformed input
 */
export type BadRequestResponseErrorData = {
    /**
     * Error data for BadRequestResponse
     */
    error: models.BadRequestResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Bad Request - Invalid request parameters or malformed input
 */
export declare class BadRequestResponseError extends OpenRouterError {
    /**
     * Error data for BadRequestResponse
     */
    error: models.BadRequestResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: BadRequestResponseErrorData;
    constructor(err: BadRequestResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const BadRequestResponseError$inboundSchema: z.ZodType<BadRequestResponseError, unknown>;
//# sourceMappingURL=badrequestresponseerror.d.ts.map