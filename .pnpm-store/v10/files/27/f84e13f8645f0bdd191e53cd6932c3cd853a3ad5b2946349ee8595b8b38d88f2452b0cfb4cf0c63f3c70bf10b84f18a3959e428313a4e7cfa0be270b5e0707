import type { JsonObject } from "./vendor/type-fest/basic";
export declare function createApiError(response: Response, opts?: {
    requestId?: string;
    message?: string;
}): Promise<never>;
/**
 * Error thrown when an API call to the Hugging Face Hub fails.
 */
export declare class HubApiError extends Error {
    statusCode: number;
    url: string;
    requestId?: string;
    data?: JsonObject;
    constructor(url: string, statusCode: number, requestId?: string, message?: string);
}
export declare class InvalidApiResponseFormatError extends Error {
}
//# sourceMappingURL=error.d.ts.map