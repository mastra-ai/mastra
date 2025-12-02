import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Internal Server Error - Unexpected server error
 */
export type InternalServerResponseErrorData = {
    /**
     * Error data for InternalServerResponse
     */
    error: models.InternalServerResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Internal Server Error - Unexpected server error
 */
export declare class InternalServerResponseError extends OpenRouterError {
    /**
     * Error data for InternalServerResponse
     */
    error: models.InternalServerResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: InternalServerResponseErrorData;
    constructor(err: InternalServerResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const InternalServerResponseError$inboundSchema: z.ZodType<InternalServerResponseError, unknown>;
//# sourceMappingURL=internalserverresponseerror.d.ts.map