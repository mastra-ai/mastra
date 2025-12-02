import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Not Found - Resource does not exist
 */
export type NotFoundResponseErrorData = {
    /**
     * Error data for NotFoundResponse
     */
    error: models.NotFoundResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Not Found - Resource does not exist
 */
export declare class NotFoundResponseError extends OpenRouterError {
    /**
     * Error data for NotFoundResponse
     */
    error: models.NotFoundResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: NotFoundResponseErrorData;
    constructor(err: NotFoundResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const NotFoundResponseError$inboundSchema: z.ZodType<NotFoundResponseError, unknown>;
//# sourceMappingURL=notfoundresponseerror.d.ts.map