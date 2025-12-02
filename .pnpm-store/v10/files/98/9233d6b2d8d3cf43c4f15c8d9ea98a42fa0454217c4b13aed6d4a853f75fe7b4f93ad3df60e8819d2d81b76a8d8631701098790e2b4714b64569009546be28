import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Payment Required - Insufficient credits or quota to complete request
 */
export type PaymentRequiredResponseErrorData = {
    /**
     * Error data for PaymentRequiredResponse
     */
    error: models.PaymentRequiredResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Payment Required - Insufficient credits or quota to complete request
 */
export declare class PaymentRequiredResponseError extends OpenRouterError {
    /**
     * Error data for PaymentRequiredResponse
     */
    error: models.PaymentRequiredResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: PaymentRequiredResponseErrorData;
    constructor(err: PaymentRequiredResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const PaymentRequiredResponseError$inboundSchema: z.ZodType<PaymentRequiredResponseError, unknown>;
//# sourceMappingURL=paymentrequiredresponseerror.d.ts.map