import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Unprocessable Entity - Semantic validation failure
 */
export type UnprocessableEntityResponseErrorData = {
    /**
     * Error data for UnprocessableEntityResponse
     */
    error: models.UnprocessableEntityResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Unprocessable Entity - Semantic validation failure
 */
export declare class UnprocessableEntityResponseError extends OpenRouterError {
    /**
     * Error data for UnprocessableEntityResponse
     */
    error: models.UnprocessableEntityResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: UnprocessableEntityResponseErrorData;
    constructor(err: UnprocessableEntityResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const UnprocessableEntityResponseError$inboundSchema: z.ZodType<UnprocessableEntityResponseError, unknown>;
//# sourceMappingURL=unprocessableentityresponseerror.d.ts.map