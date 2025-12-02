import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Payload Too Large - Request payload exceeds size limits
 */
export type PayloadTooLargeResponseErrorData = {
    /**
     * Error data for PayloadTooLargeResponse
     */
    error: models.PayloadTooLargeResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Payload Too Large - Request payload exceeds size limits
 */
export declare class PayloadTooLargeResponseError extends OpenRouterError {
    /**
     * Error data for PayloadTooLargeResponse
     */
    error: models.PayloadTooLargeResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: PayloadTooLargeResponseErrorData;
    constructor(err: PayloadTooLargeResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const PayloadTooLargeResponseError$inboundSchema: z.ZodType<PayloadTooLargeResponseError, unknown>;
//# sourceMappingURL=payloadtoolargeresponseerror.d.ts.map