import { GenericServerException } from './generic-server.exception';
export declare class RateLimitExceededException extends GenericServerException {
    /**
     * The number of seconds to wait before retrying the request.
     */
    readonly retryAfter: number | null;
    readonly name = "RateLimitExceededException";
    constructor(message: string, requestID: string, 
    /**
     * The number of seconds to wait before retrying the request.
     */
    retryAfter: number | null);
}
