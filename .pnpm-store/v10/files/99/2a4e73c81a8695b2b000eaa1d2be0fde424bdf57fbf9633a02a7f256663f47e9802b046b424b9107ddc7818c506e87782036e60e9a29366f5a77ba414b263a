import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Service Unavailable - Service temporarily unavailable
 */
export type ServiceUnavailableResponseErrorData = {
    /**
     * Error data for ServiceUnavailableResponse
     */
    error: models.ServiceUnavailableResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Service Unavailable - Service temporarily unavailable
 */
export declare class ServiceUnavailableResponseError extends OpenRouterError {
    /**
     * Error data for ServiceUnavailableResponse
     */
    error: models.ServiceUnavailableResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: ServiceUnavailableResponseErrorData;
    constructor(err: ServiceUnavailableResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const ServiceUnavailableResponseError$inboundSchema: z.ZodType<ServiceUnavailableResponseError, unknown>;
//# sourceMappingURL=serviceunavailableresponseerror.d.ts.map