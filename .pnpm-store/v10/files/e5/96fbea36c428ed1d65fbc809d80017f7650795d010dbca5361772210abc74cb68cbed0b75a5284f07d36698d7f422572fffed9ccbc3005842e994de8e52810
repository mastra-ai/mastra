import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
/**
 * Bad Gateway - Provider/upstream API failure
 */
export type BadGatewayResponseErrorData = {
    /**
     * Error data for BadGatewayResponse
     */
    error: models.BadGatewayResponseErrorData;
    userId?: string | null | undefined;
};
/**
 * Bad Gateway - Provider/upstream API failure
 */
export declare class BadGatewayResponseError extends OpenRouterError {
    /**
     * Error data for BadGatewayResponse
     */
    error: models.BadGatewayResponseErrorData;
    userId?: string | null | undefined;
    /** The original data that was passed to this error instance. */
    data$: BadGatewayResponseErrorData;
    constructor(err: BadGatewayResponseErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const BadGatewayResponseError$inboundSchema: z.ZodType<BadGatewayResponseError, unknown>;
//# sourceMappingURL=badgatewayresponseerror.d.ts.map